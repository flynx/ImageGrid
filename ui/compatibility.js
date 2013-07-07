/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// XXX move this to the config...
var PREVIEW_SIZES = [
	// NOTE: this is first so as to prevent the hi-res from loading...
	// XXX this is best to be screen sized or just a little bigger...
	1280,
	150,
	350,
	900
]


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
	var crypto = require('crypto')
	//var exif = require('exif2')
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

	// XXX this uses vips...
	// XXX handle errors...
	// NOTE: source can be either gid or a path...
	window._getImageSize = function(dimension, source){
		if(source in IMAGES){
			var img = IMAGES[gid]
			var source = normalizePath(img.path)
		}
		var getter = $.Deferred()
		if(dimension == 'max' || dimension == 'min'){
			$.when(
					_getImageSize('width', source), 
					_getImageSize('height', source))
				.done(function(w, h){
					getter.resolve(Math[dimension](w, h))
				})

		} else if(dimension == 'width' || dimension == 'height') {
			var cmd = 'vips im_header_int $DIM "$IN"'
				.replace(/\$IN/g, source.replace(fp, ''))
				.replace(/\$DIM/g, dimension)
			proc.exec(cmd, function(error, stdout, stderr){
				getter.resolve(parseInt(stdout.trim()))
			})

		} else {
			// wrong dimension...
			return getter.reject('unknown dimension:' + dimension)
		}

		return getter
	}

	// NOTE: source can be either gid or a path...
	window.getImageOrientation = function(source){
		if(source in IMAGES){
			var img = IMAGES[source]
			var source = normalizePath(img.path)
		}
		var getter = $.Deferred()
		var cmd = 'vips im_header_string exif-ifd0-Orientation "$IN"'
			.replace(/\$IN/g, source.replace(fp, ''))
		proc.exec(cmd, function(error, stdout, stderr){
			getter.resolve(orientationExif2ImageGrid(parseInt(stdout.trim())))
		})
		return getter
	}

	// preview generation...
	//
	// possible modes:
	// 		- optimized
	// 			use closest rscale and minimal factor
	// 			previews might get artifacts associated with small scale factors
	// 			0.55x time
	// 		- best
	// 			only use scale factor (rscale=1)
	// 			1x time (fixed set of previews: 1280, 150, 350, 900)
	// 		- fast 
	// 			make previews using nearest rscale (factor is rounded)
	// 			will produce inexact sizes
	// 			0.42x time
	// 		- rscale
	// 			only use rscale (factor=1)
	// 			produces only fixed size previews
	// 			0.32x time
	//
	// NOTE: rscale should be used for exactly tuned preview sizes...
	// NOTE: this will add already existing previews to IMAGES[gid]...
	//
	// XXX make this not just vips-specific...
	// XXX path handling is a mess...
	window.makeImagePreviews = function(gid, sizes, mode, no_update_loaded){
		mode = mode == null ? 'optimized' : mode

		var img = IMAGES[gid]
		var source = normalizePath(img.path)
		var name = gid +' - '+ source.split('/').pop()
		var compression = 90

		var previews = []

		// prepare the sizes we are going to be working with...
		if(sizes == null){
			sizes = PREVIEW_SIZES
		} else if(typeof(sizes) == typeof(123)){
			sizes = [ sizes ]
		}

		// build usable local path (without 'file:///')...
		var cache_path = normalizePath(CACHE_DIR)
		cache_path = cache_path.replace(fp, '')

		// get cur image size...
		var size_getter = _getImageSize('max', source)

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
			[function(size, target_path, deferred){
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
						// this can be 1, 2, 4 or 8...
						var rscale = 1

						// speed things up with read-scaling and rounding the scale factor...
						if(mode == 'fast' || mode == 'optimized' || mode == 'rscale'){
							while(rscale < 8){
								if(rscale*2 >= factor){
									break
								}
								rscale *= 2
							}
							factor = factor / rscale
						}
						if(mode == 'fast'){
							factor = Math.round(factor)
						} else if(mode == 'rscale'){
							factor = 1
						}

						// XXX make this compatible with other image processors...
						var cmd = 'vips im_shrink "$IN:$RSCALE" "$OUT:$COMPRESSION" $FACTOR $FACTOR'
							.replace(/\$IN/g, source.replace(fp, ''))
							.replace(/\$RSCALE/g, rscale)
							.replace(/\$OUT/g, preview_path)
							.replace(/\$COMPRESSION/g, compression)
							.replace(/\$FACTOR/g, factor)

						console.log(cmd)

						proc.exec(cmd, function(error, stdout, stderr){
							if(error != null){
								//console.error('>>> Error: preview:', stderr)
								deferred.notify(gid, size, 'error', stderr)
								deferred.reject()

							} else {
								// XXX use real size of the preview generated (???)
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
			}(size, target_path, deferred)]
		}

		var res = $.when.apply(null, previews)

		// update loaded images...
		if(!no_update_loaded){
			res.done(function(){
				var o = getImage(gid)
				if(o.length > 0){
					updateImage(o)
				}
			})
		}

		return res
	}

	// XXX needs more testing...
	// 		- for some reason this is a bit slower than the queued version
	// 			...in spite of being managed by node.js
	// 		- will this be faster on SMP/multi-core?
	window.makeImagesPreviews = function(gids, sizes, mode){
		gids = gids == null ? getClosestGIDs() : gids
		return $.when.apply(null, gids.map(function(gid){
			return makeImagePreviews(gid, sizes, mode)
		}))
	}

	window._PREVIW_CREATE_QUEUE = null
	// Queued version of makeImagesPreviews(...)
	//
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
	window.makeImagesPreviewsQ = function(gids, sizes, mode, keep_log){
		gids = gids == null ? getClosestGIDs() : gids
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
				makeImagePreviews(e, sizes, mode)
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

	// XXX should this be sync???
	/*
	window.makeImageGID = function(path, make_text_gid){

		// XXX get exif...

		var artist =
		// format: "20130102-122315"
		var date = 
		var name = path.split(/[\\\/]/).pop().split('.')[0]

		var text_gid = artist +'-'+ date +'-'+ name

		if(make_text_gid){
			return text_gid
		}

		var h = crypto.createHash('sha1')
		h.update(text_gid)
		var hex_gid = h.digest('hex')

		return hex_gid
	}
	*/

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
