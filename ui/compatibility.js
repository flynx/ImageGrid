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

	var path = require('path')
	var fs = require('fs')
	var fse = require('fs.extra')
	var proc = require('child_process')
	var node_crypto = require('crypto')

	//var exif = require('exif2')

	var gui = require('nw.gui')


	window.osPath = function(p){
		return path
			.normalize(p.replace(/file:\/\/\//, ''))
	}
	window.execPathPush = function(p){
		process.env.PATH += ';' + path.normalize(path.dirname(process.execPath) + '/' + p)
	}


	// paths to included utils...
	execPathPush('./vips/bin')

	// Things ImageGrid needs...
	// XXX do we need assync versions??
	window.listDir = function(path){
		return fs.readdirSync(osPath(path))
	}
	// XXX make this work across fs...
	// XXX this will not overwrite...
	// XXX set ctime to the same value as the original...
	window.copyFile = function(src, dst){
		var deferred = $.Deferred()
		src = osPath(src)
		dst = osPath(dst)

		var path = dst.split(/[\\\/]/)
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
		path = osPath(path)
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
		return fs.unlinkSync(osPath(path))
	}
	window.runSystem = function(path){
		return proc.exec('"'+osPath(path)+'"', function(error, stdout, stderr){
			if(error != null){
				console.error(stderr)
			}
		})
	}

	// XXX this uses vips...
	window.getVipsField = function(field, source){
		if(source in IMAGES){
			var img = IMAGES[source]
			var source = normalizePath(img.path)
		}
		var getter = $.Deferred()
		var cmd = 'vips im_header_string "$FIELD" "$IN"'
			.replace(/\$IN/g, osPath(source))
			.replace(/\$FIELD/g, field)
		proc.exec(cmd, function(error, stdout, stderr){
			getter.resolve(stdout.trim())
		})
		return getter
	}

	// NOTE: source can be either gid or a path...
	window.getImageOrientation = function(source){
		var getter = $.Deferred()
		getVipsField('exif-ifd0-Orientation', source)
			.done(function(o){
				getter.resolve(orientationExif2ImageGrid(parseInt(o)))
			})
		return getter
	}

	// NOTE: source can be either gid or a path...
	// XXX handle errors...
	window._getImageSize = function(dimension, source){
		if(source in IMAGES){
			var img = IMAGES[source]
			var source = normalizePath(img.path)
		}
		var getter = $.Deferred()

		// get max/min dimension...
		if(dimension == 'max' || dimension == 'min'){
			$.when(
					_getImageSize('width', source), 
					_getImageSize('height', source))
				.done(function(w, h){
					getter.resolve(Math[dimension](w, h))
				})

		// get dimension...
		} else if(dimension == 'width' || dimension == 'height') {
			getVipsField(dimension, source)
				.done(function(res){
					getter.resolve(parseInt(res))
				})

		// wrong dimension...
		} else {
			return getter.reject('unknown dimension:' + dimension)
		}

		return getter
	}

	// XXX API to add to $PATH...

	// preview generation...
	//
	// possible modes:
	// 		- optimized
	// 			use closest rscale and minimal factor
	// 			previews might get artifacts associated with small scale factors
	// 			0.5x time
	// 		- best
	// 			only use scale factor (rscale=1)
	// 			1x time (fixed set of previews: 1280, 150, 350, 900)
	// 		- fast_r 
	// 			make previews using nearest rscale (factor is rounded)
	// 			will produce inexact preview sizes
	// 			0.4x time
	// 		- fast_f
	// 			same as fast_r but factor is floored rather than rounded
	// 			will priduce previews the same size or larger than requested
	// 		- rscale
	// 			only use rscale (factor=1)
	// 			produces only fixed size previews
	// 			0.3x time
	//
	// NOTE: rscale should be used for exactly tuned preview sizes...
	// NOTE: this will add already existing previews to IMAGES[gid]...
	//
	// XXX make this not just vips-specific...
	// XXX path handling is a mess...
	// XXX looks a bit too complex for what it is -- revise!
	window.makeImagePreviews = function(gid, sizes, mode, no_update_loaded){
		mode = mode == null ? 'fast_f' : mode

		var cache_dir = CONFIG.cache_dir

		var img = IMAGES[gid]
		var source = normalizePath(img.path)
		var name = gid +' - '+ source.split(/[\\\/]/).pop()
		var compression = 90

		var previews = []

		// prepare the sizes we are going to be working with...
		if(sizes == null){
			sizes = PREVIEW_SIZES
		} else if(typeof(sizes) == typeof(123)){
			sizes = [ sizes ]
		}

		// build usable local path (without 'file:///')...
		var cache_path = normalizePath(cache_dir)
		cache_path = osPath(cache_path)

		// get cur image size...
		var size_getter = _getImageSize('max', source)

		for(var i=0; i < sizes.length; i++){
			var size = sizes[i]
			// XXX get this from config...
			var target_path = [ cache_path, size+'px' ].join('/')

			var deferred = $.Deferred()
			previews.push(deferred)

			[function(size, target_path, deferred){
				// wait for current image size if needed...
				size_getter.done(function(source_size){

					// handle existing previews...
					if(fs.existsSync(target_path +'/'+ name)){
						// see if we know about the preview...
						if(img.preview == null || !((size+'px') in img.preview)){
							var preview_path = [target_path, name].join('/')
							// add the preview to the image object...
							img.preview[size+'px'] = './' + cache_dir +'/'+ preview_path.split(cache_dir).pop()
							// mark image dirty...
							imageUpdated(gid)
						}
						//console.log('>>> Preview:', name, '('+size+'): Exists.')
						deferred.notify(gid, size, 'exists')
						return deferred.resolve()

					// skip previews larger than cur image...
					} else if(source_size <= size){
						//console.log('>>> Preview:', name, '('+size+'): Skipped.')
						deferred.notify(gid, size, 'skipped')
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
						if(['fast_r', 'fast_f', 'optimized', 'rscale'].indexOf(mode) >= 0){
							while(rscale < 8){
								if(rscale*2 >= factor){
									break
								}
								rscale *= 2
							}
							factor = factor / rscale
						}
						// factor processing...
						if(mode == 'fast_r'){
							factor = Math.max(Math.round(factor), 1)

						} else if(mode == 'fast_f'){
							// NOTE: .floor(...) will make the images larger than
							// 		the requested size, this will avaoid scale-up
							// 		artifacts...
							factor = Math.max(Math.floor(factor), 1)

						} else if(mode == 'rscale'){
							factor = 1
						}

						var cmd = 'vips im_shrink "$IN:$RSCALE" "$OUT:$COMPRESSION" $FACTOR $FACTOR'
							.replace(/\$IN/g, osPath(source))
							.replace(/\$RSCALE/g, rscale)
							.replace(/\$OUT/g, preview_path)
							.replace(/\$COMPRESSION/g, compression)
							.replace(/\$FACTOR/g, factor)

						//console.log(cmd)

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
								img.preview[size+'px'] = './' + cache_dir +'/'+ preview_path.split(cache_dir).pop()
								// mark image dirty...
								imageUpdated(gid)
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

	// Queued version of makeImagesPreviews(...)
	window.makeImagesPreviewsQ = function(gids, sizes, mode){
		gids = gids == null ? getClosestGIDs() : gids

		var queue = getWorkerQueue('preview_generator')

		// attach the workers to the queue...
		$.each(gids, function(_, gid){
			queue.enqueue(null, makeImagePreviews, gid, sizes, mode)
				// XXX do we need to report seporate previews???
				//.progress(function(state){ queue.notify(state) })
				.always(function(){ queue.notify(gid, 'done') })
		})

		return queue
	}

	// format: "20130102-122315"
	window.getEXIFDate = function(source){
		var getter = $.Deferred()
		getVipsField('exif-ifd0-Date and Time', source)
			.done(function(date){
				getter.resolve(date
					// remove substrings in braces...
					.replace(/\([^)]*\)/, '')
					.trim()
					.replace(/:/g, '')
					.replace(/ /g, '-'))
			})
		return getter
	}

	window.getEXIFGID = function(source, make_text_gid){
		if(source in IMAGES){
			var img = IMAGES[source]
			var source = normalizePath(img.path)
		}
		var getter = $.Deferred()

		$.when(
				getVipsField('exif-ifd0-Artist', source),
				getEXIFDate(source))
			.done(function(artist, date){
				// Artist...
				artist = artist
					// remove substrings in braces...
					.replace(/\([^)]*\)/, '')
					.trim()
				artist = artist == '' ? 'Unknown' : artist

				// Date...
				// XXX if not set, get ctime...
				// XXX

				// File name...
				var name = source.split(/[\\\/]/).pop().split('.')[0]

				var text_gid = artist +'-'+ date +'-'+ name

				// text gid...
				if(make_text_gid){
					getter.resolve(text_gid)

				// hex gid...
				} else {
					var h = node_crypto.createHash('sha1')
					h.update(text_gid)
					var hex_gid = h.digest('hex')

					getter.resolve(hex_gid)
				}
			})
			// XXX handle arrors in a more informative way...
			.fail(function(){
				getter.reject()
			})
		return getter
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
		var title = text +' - '+ CONFIG.app_name
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
