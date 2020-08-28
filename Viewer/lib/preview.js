/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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
// XXX add a callback call when a gid is done...
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

		callback && callback(null, {
			status: 'queued', 
			gid: gid, 
			res: 'all', 
		})

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
			return Promise
				.all(sizes
					.map(function(res){
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
									return }
							
								// make the actual previews...
								return img.clone()
									.resize({
										width: res,
										height: res,
										fit: 'inside',
									})
									.withMetadata()
									.toFile(full)
										.then(function(){
											callback 
												&& callback(null, {
													status: 'done', 
													gid: gid, 
													res: res, 
													path: rel,
													orientation: metadata.orientation, }) })
							})
					}))
				// report a gid is done...
				.then(function(){
					callback 
						&& callback(null, {
							status: 'done', 
							gid: gid, 
							res: 'all', 
						}) }) })
	}))
}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
