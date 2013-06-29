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


		// XXX make dirs...
		if(!fs.existsSync(path)){
			console.log('making:', path)
			fse.mkdirRecursiveSync(path)
		}

		if(!fs.existsSync(dst)){
			// NOTE: this is not sync...
			return fse.copy(src, dst)
		}
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

	// vips preview generation...
	// XXX make this queuable...
	window.makeImagePreviews = function(gid){

		var img = IMAGES[gid]
		var source = normalizePath(img.path)
		var name = gid +' - '+ source.split('/').pop()
		var compression = 90

		var previews = []

		// XXX get real sizes from config...
		var sizes = [
				150,
				350,
				900
			]

		// XXX take this from config...
		var path = normalizePath(CACHE_DIR)
		path = path.replace(fp, '')

		// XXX get cur image size...
		var size_getter = $.Deferred()
		var _i = new Image()
		_i.onload = function(){
			size_getter.resolve(Math.max(parseInt(this.width), parseInt(this.height)))
		} 
		_i.src = source
		
		for(var i=0; i < sizes.length; i++){
			var size = sizes[i]
			var target_path = [ path, size+'px' ].join('/')

			var deferred = $.Deferred()
			previews.push(deferred)

			// NOTE: for some magical reason writing this like this:
			// 		(function(...){
			// 			...
			// 		}(...))
			// 		produces a "undefined is not a function" in except the 
			// 		first invocation...
			var _f = function(size, target_path, deferred){
				size_getter.done(function(source_size){

					// skip previews larger than cur image...
					if(fs.existsSync(target_path +'/'+ name) || source_size <= size){
						console.log('>>> Preview:', name, '('+size+'): Skipped.')
						return deferred.resolve()
					}

					// XXX check for errors...
					fse.mkdirRecursive(target_path, function(err){

						var preview_path = [target_path, name].join('/')
						var factor = source_size / size

						var cmd = 'vips im_shrink "$IN" "$OUT:$COMPRESSION" $FACTOR $FACTOR'
							.replace(/\$IN/g, source.replace(fp, ''))
							.replace(/\$OUT/g, preview_path)
							.replace(/\$COMPRESSION/g, compression)
							.replace(/\$FACTOR/g, factor)

						proc.exec(cmd, function(error, stdout, stderr){
							if(error != null){
								console.error('>>> Error: preview:', stderr)
								deferred.reject()

							} else {

								console.log('>>> Preview:', name, '('+size+'): Done.')

								if(!('preview' in img)){
									img.preview = {}
								}

								img.preview[size+'px'] = './' + CACHE_DIR +'/'+ preview_path.split(CACHE_DIR).pop()

								// mark image dirty...
								if(IMAGES_UPDATED.indexOf(gid) < 0){
									IMAGES_UPDATED.push(gid)
								}

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

	// XXX is this robust enough???
	window._PREVIW_CREATE_QUEUE = null
	window.makeImagesPreviewsQ = function(gids){
		var previews = []

		$.each(gids, function(i, e){
			var deferred = $.Deferred()

			var last = previews[previews.length-1]

			// first in this set...
			if(last == null){
				if(_PREVIW_CREATE_QUEUE == null){
					// if nothing in queue, start at once...
					last = $.Deferred().resolve()
				} else {
					last = _PREVIW_CREATE_QUEUE
				}
			}

			// append to deffered queue...
			last.always(function(){
				makeImagePreviews(e)
					.always(function(){
						deferred.resolve()
					})
			})

			previews.push(deferred)
		})

		_PREVIW_CREATE_QUEUE = $.when.apply(null, previews)
		return _PREVIW_CREATE_QUEUE
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
