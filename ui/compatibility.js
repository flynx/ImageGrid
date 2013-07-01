/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// load the target-specific handlers...
// CEF
if(window.CEF_dumpJSON != null){

	console.log('CEF mode: loading...')

	var dumpJSON = CEF_dumpJSON
	var listDir = CEF_listDir
	var removeFile = CEF_removeFile
	var runSystem = CEF_runSystem

// node-webkit
} else if(window.require != null){

	console.log('node-webkit mode: loading...')

	var fs = require('fs')
	var fse = require('fs.extra')
	var proc = require('child_process')
	var gui = require('nw.gui')

	var fp = /file:\/\/\//

	// Things ImageGrid needs...
	// XXX do we need assync versions??
	window.listDir = function(path){
		if(fp.test(path)){
			// XXX will this work on Mac???
			path = path.replace(fp, '')
		}
		return fs.readdirSync(path)
	}
	// XXX make this work across fs...
	// XXX this will not overwrite...
	window.copyFile = function(src, dst){
		var deferred = $.Deferred()
		if(fp.test(src)){
			// XXX will this work on Mac???
			src = src.replace(fp, '')
		}
		if(fp.test(dst)){
			// XXX will this work on Mac???
			dst = dst.replace(fp, '')
		}

		var path = dst.split('/')
		path.pop()
		path = path.join('/')


		// make dirs...
		if(!fs.existsSync(path)){
			console.log('making:', path)
			fse.mkdirRecursiveSync(path)
		}

		if(!fs.existsSync(dst)){
			// NOTE: this is not sync...
			fse.copy(src, dst, function(err){
				if(err){
					deferred.reject(err)
				} else {
					deferred.resolve()
				}
			})
			return deferred
		}
		deferred.notify(dst, 'exists')
		return deferred.resolve()
	}
	window.dumpJSON = function(path, data){
		if(fp.test(path)){
			// XXX will this work on Mac???
			path = path.replace(fp, '')
		}
		var dirs = path.split(/[\\\/]/)
		dirs.pop()
		dirs = dirs.join('/')
		// build path...
		if(!fs.existsSync(dirs)){
			console.log('making:', path)
			fse.mkdirRecursiveSync(path)
		}
		return fs.writeFileSync(path, JSON.stringify(data), encoding='utf8')
	}
	window.removeFile = function(path){
		if(fp.test(path)){
			// XXX will this work on Mac???
			path = path.replace(fp, '')
		}
		return fs.unlinkSync(path)
	}
	window.runSystem = function(path){
		if(fp.test(path)){
			// XXX will this work on Mac???
			path = path.replace(fp, '')
		}
		return proc.exec('"'+path+'"', function(error, stdout, stderr){
			if(error != null){
				console.error(stderr)
			}
		})
	}

	// preview generation...
	//
	// NOTE: this will add already existing previews to IMAGES[gid]...
	//
	// XXX make this not just vips-specific...
	// XXX path handling is a mess...
	window.makeImagePreviews = function(gid, sizes){

		var img = IMAGES[gid]
		var source = normalizePath(img.path)
		var name = gid +' - '+ source.split('/').pop()
		var compression = 90

		var previews = []

		// prepare the sizes we are going to be working with...
		if(sizes == null){
			// XXX get real sizes from config...
			var sizes = [
					150,
					350,
					900
				]
		} else if(typeof(sizes) == typeof(123)){
			sizes = [ sizes ]
		}

		// build usable local path (without 'file:///')...
		var cache_path = normalizePath(CACHE_DIR)
		cache_path = cache_path.replace(fp, '')

		// get cur image size...
		var size_getter = $.Deferred()
		var _i = new Image()
		_i.onload = function(){
			size_getter.resolve(Math.max(parseInt(this.width), parseInt(this.height)))
		} 
		_i.src = source
		
		for(var i=0; i < sizes.length; i++){
			var size = sizes[i]
			// XXX get this from config...
			var target_path = [ cache_path, size+'px' ].join('/')

			var deferred = $.Deferred()
			previews.push(deferred)

			// NOTE: for some magical reason writing this like:
			// 		(function(...){
			// 			...
			// 		}(...))
			// 		produces a "undefined is not a function" in part of the
			// 		invocations, usually the later ones...
			var _f = function(size, target_path, deferred){
				// wait for current image size if needed...
				size_getter.done(function(source_size){

					// skip previews larger than cur image...
					if(fs.existsSync(target_path +'/'+ name) || source_size <= size){
						// see if we know about the preview...
						if(img.preview == null || !((size+'px') in img.preview)){
							var preview_path = [target_path, name].join('/')
							// add the preview to the image object...
							img.preview[size+'px'] = './' + CACHE_DIR +'/'+ preview_path.split(CACHE_DIR).pop()
							// mark image dirty...
							if(IMAGES_UPDATED.indexOf(gid) < 0){
								IMAGES_UPDATED.push(gid)
							}
						}
						//console.log('>>> Preview:', name, '('+size+'): Skipped.')
						deferred.notify(gid, size, 'exists')
						return deferred.resolve()
					}

					// create the directory then go to its content...
					// XXX check for errors...
					fse.mkdirRecursive(target_path, function(err){

						var preview_path = [target_path, name].join('/')
						var factor = source_size / size

						// XXX make this compatible with other image processors...
						var cmd = 'vips im_shrink "$IN" "$OUT:$COMPRESSION" $FACTOR $FACTOR'
							.replace(/\$IN/g, source.replace(fp, ''))
							.replace(/\$OUT/g, preview_path)
							.replace(/\$COMPRESSION/g, compression)
							.replace(/\$FACTOR/g, factor)

						proc.exec(cmd, function(error, stdout, stderr){
							if(error != null){
								//console.error('>>> Error: preview:', stderr)
								deferred.notify(gid, size, 'error', stderr)
								deferred.reject()

							} else {
								//console.log('>>> Preview:', name, '('+size+'): Done.')
								deferred.notify(gid, size, 'done')
								// update the image structure...
								if(!('preview' in img)){
									img.preview = {}
								}
								img.preview[size+'px'] = './' + CACHE_DIR +'/'+ preview_path.split(CACHE_DIR).pop()
								// mark image dirty...
								if(IMAGES_UPDATED.indexOf(gid) < 0){
									IMAGES_UPDATED.push(gid)
								}
								// we are done...
								deferred.resolve()
							}
						})
					})
				})
			}
			// NOTE: wrapping this in a closure saves the specific data that would
			// 		otherwise be overwritten by the next loop iteration...
			_f(size, target_path, deferred)
		}

		return $.when.apply(null, previews)
	}

	window._PREVIW_CREATE_QUEUE = null
	// XXX is this robust enough???
	// 		of one deferred hangs or breaks without finalizing this will 
	// 		stall the whole queue...
	// 		...need a way to jumpstart it again...
	// XXX check if we are leaking the tail...
	// XXX test progress...
	// 		...gets collected but the structure is a tad too complex...
	// NOTE: this will remove the old deferred if it us resolved, thus
	// 		clearing the "log" of previous operations, unless keep_log
	// 		is set to true...
	window.makeImagesPreviewsQ = function(gids, keep_log){
		var previews = []

		$.each(gids, function(i, e){
			var deferred = $.Deferred()

			var last = previews[previews.length-1]

			// first in this set -- attach to the queue...
			if(last == null){
				if(_PREVIW_CREATE_QUEUE == null
						|| (!keep_log && _PREVIW_CREATE_QUEUE.state() == 'resolved')){
					// if nothing in queue, start at once...
					last = $.Deferred().resolve()
				} else {
					last = _PREVIW_CREATE_QUEUE
				}
			}

			// append to deffered queue...
			last.always(function(){
				makeImagePreviews(e)
					.progress(function(state){
						deferred.notify(state)
					})
					.always(function(){
						deferred.resolve()
					})
			})

			previews.push(deferred)
		})

		_PREVIW_CREATE_QUEUE = $.when.apply(null, previews)
		return _PREVIW_CREATE_QUEUE
	}

	// UI-specific...
	window.toggleFullscreenMode = createCSSClassToggler(
			document.body, 
			'.full-screen-mode',
			function(action){
				gui.Window.get().toggleFullscreen()
			})

	window.closeWindow = function(){
		gui.Window.get().close()
	}
	window.showDevTools = function(){
		gui.Window.get().showDevTools()
	}
	window.reload = function(){
		gui.Window.get().reload()
	}
	window.setWindowTitle = function(text){
		var title = text +' - '+ APP_NAME
		gui.Window.get().title = title
		$('.title-bar .title').text(title)
	}

	// load UI stuff...
	$(function(){
		$('<div class="title-bar"/>')
			.append($('<div class="title"></div>')
				.text($('title').text()))
			.append($('<div class="button close" onclick="closeWindow()">&times;</div>'))
			.appendTo($('body'))
	})




// PhoneGap
} else if(false){

	console.log('PhoneGap mode: loading...')
	// XXX

	// stubs...
	window.toggleFullscreenMode = function(){}
	window.closeWindow = function(){}
	window.showDevTools = function(){}
	window.reload = function(){}

// Bare Chrome...
} else {
	console.log('Chrome mode: loading...')

	// stubs...
	window.toggleFullscreenMode = function(){}
	window.closeWindow = function(){}
	window.showDevTools = function(){}
	window.reload = function(){}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
