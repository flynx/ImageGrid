/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

try{
	var sharp = requirejs('sharp')

} catch(err){
	var sharp = null
}

if(typeof(process) != 'undefined'){
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var file = requirejs('imagegrid/file')
}



/*********************************************************************/

if(typeof(process) != 'undefined'){
	var ensureDir = file.denodeify(fse.ensureDir)
}



/*********************************************************************/

// images format:
// 	[
// 		{
// 			source: <source>,
// 			gid: <gid>,
// 		},
// 		...
// 	]
//
var makePreviews = 
module.makePreviews =
function(images, sizes, base_path, target_tpl, callback){
	var that = this

	var target_path = (target_tpl
			|| 'preview/${RESOLUTION}px/${NAME}.jpg')

	// iterate images...
	return Promise.all(images.map(function(data){
		var gid = data.gid || ''
		var source = data.source

		var ext = pathlib.extname(source)
		var name = pathlib.basename(source)
			.replace(RegExp(ext + '$'), '')

		var target = target_path
			.replace(/\$NAME|\$\{NAME\}/g, name)
			.replace(/\$GID|\$\{GID\}/g, gid)

		var img = sharp(source)
		// get metadata....
		return img.metadata().then(function(metadata){
			var orig_res = Math.max(metadata.width, metadata.height)

			// process previews...
			return Promise.all(sizes.map(function(res){
				// skip if image is smaller than res...
				if(res >= orig_res){
					return 
				}

				var rel = target 
					.replace(/\$RESOLUTION|\$\{RESOLUTION\}/g, res)
				var full = pathlib.join(base_path || '', rel)

				callback && callback(null, {
					status: 'queued', 
					gid: gid, 
					res: res, 
					path: rel
				})

				// make the dir...
				return ensureDir(pathlib.dirname(full))
					.then(function(){
						// check if image exists...
						if(fse.existsSync(full)){
							callback && callback(null, {
								status: 'skipped', 
								gid: gid, 
								res: res, 
								path: rel,
								orientation: metadata.orientation,
							})

							return
						}
					
						// make the actual previews...
						return img.clone()
							.resize(res, res)
							.max()
							// XXX this causes odd image errors 
							// 		...white pixels in random black areas...	
							//.interpolateWith('nohalo')
							.withMetadata()
							.toFile(full)
								.then(function(){
									callback && callback(null, {
										status: 'done', 
										gid: gid, 
										res: res, 
										path: rel,
										orientation: metadata.orientation,
									})
								})
					})
			}))
		})
	}))
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
