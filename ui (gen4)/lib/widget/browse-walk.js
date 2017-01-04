/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(process) != 'undefined'){
	var os = requirejs('os')
	var fs = requirejs('fs')
	var path = requirejs('path')
	var glob = requirejs('glob')
	var guaranteeEvents = requirejs('guarantee-events')

} else {
	return module
}


//var DEBUG = DEBUG != null ? DEBUG : true

var object = require('../object')
var browse = require('./browse')


/*********************************************************************/
// XXX need a root management to do OS-specific root dir management...
// 		e.g. X:/.. and /Volume/..

// XXX mostly works, does not list drive letter root dirs, deeper paths 
// 		work...
// XXX appears to hang and crash on large lists....
var listDirGlob = 
module.listDirGlob =
function(path, make){
	var that = this
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path

	// if not a glob then just list contents...
	var fullpath = path.indexOf('*') >= 0
	path = path.indexOf('*') < 0 ? path + '/*' : path

	return new Promise(function(resolve, reject){

		// XXX test...
		if(that.options.dotDirs){
			make(fullpath ? path + './' : './')
			make(fullpath ? path + '../' : '../')
		}

		// XXX do we need this???
		/*guaranteeEvents([
				'match',
				'error',
			], 
			glob.glob(path))*/
			glob.glob(path)
				.on('match', function(path){
					fs.stat(path, function(err, stat){
						if(err){
							make(fullpath ? path : path.split(/[\\\/]/).pop(), null, true)
						} else {
							make(fullpath ? path : path.split(/[\\\/]/).pop() 
								+ (stat.isDirectory() ? '/' : ''))
						}
					})
				})
				// XXX do this after all the stats are done...
				.on('end', function(){
					resolve()
				})
	})
}

// XXX might be good to add some caching...
var listDirfs = 
module.listDirfs =
function(path, make){
	var that = this
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path
	// XXX the windows root path must have a trailing '/'
	path = /^[a-zA-Z]:$/.test(path.trim()) ? path+'/' : path

	// XXX expose these as config...
	var fullpath = false

	// sync version of stat...
	// XXX if we decide to keep this, then we'll need to cleanup the 
	// 		code below...
	var stat = function(path){
		return new Promise(function(resolve, reject){
			try {
				resolve(fs.statSync(path))
			} catch(err){
				reject(err)
			}
		})
	}

	/*
	var stat = function(path){
		return new Promise(function(resolve, reject){
			fs.stat.call(fs, path, function(err, res){
				err ? reject(err) : resolve(res)
			})
		})
	}
	*/

	// get the drive list on windows...
	if(os.type() == 'Windows_NT' && path == '/'){
		return new Promise(function(resolve, reject){
			// NOTE: this is a bit brain-dead but it gets the job done 
			// 		and faster than fancy modules like drivelist...
			'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
				.split('')
				.forEach(function(drive){
					stat(drive+':/')
						// XXX
						.catch(function(err){ })
						.then(function(data){
							data && make(drive+':/')

							// resolve when we are done...
							if(drive == 'Z'){
								resolve()
							}
						})
			})
		})

	// list dirs...
	} else {
		var _countDirFiles = function(path, file, elem){
			if(that.options.fileCountPattern){
				var i = 0
				glob(path +'/'+ file +'/'+ that.options.fileCountPattern)
					/*
					.on('match', function(){
						i += 1
						elem.attr('count', '('+ i +')')
					})
					*/
					.on('end', function(lst){
						i += 1
						elem.attr('count', lst.length)
					})
			}
			return elem
		}

		return new Promise(function(resolve, reject){
			// XXX should this be a promise???
			fs.readdir(path, function(err, files){
				// XXX
				if(err){
					reject(err)
					return
				}
				var res = []

				if(that.options.dotDirs){
					// NOTE: this sometimes gets reordered so we aren't 
					// 		using it... (BUG?)
					//			files.splice(0, 0, '.', '..')
					// NOTE: we are counting these here so as to ensure 
					// 		they are always first and not delayed by some
					// 		odd delay on a stat...
					_countDirFiles(path, './',
						make(fullpath ? path + './' : './'))
					_countDirFiles(path, '../',
						make(fullpath ? path + '../' : '../'))
				}

				// XXX split out the making stage after the stat stage to
				// 		be able to sort suff correctly...
				files
					.map(function(file){
						return stat(path +'/'+ file)
							.catch(function(err){
								make(fullpath 
									? path +'/'+ file 
									: file, null, true)
							})
							.then(function(res){
								// can't read stat... (XXX ???)
								if(res == null){
									make(fullpath 
										? path +'/'+ file 
										: file, null, true)
									return
								}

								var dir = res.isDirectory()
								var elem = res && make(fullpath 
										? path +'/'+ file 
										: file + (dir ? '/' : ''),
									null,
									that.options.disableFiles && !dir)

								// count the number of files...
								// NOTE: we do not care how long it will take
								// 		so we'll not wait...
								res && dir && _countDirFiles(path, file, elem)
							})
							// NOTE: we are not using promise.all(..) here because it
							// 		triggers BEFORE the first make(..) is called...
							// 		...not sure I fully understand why...
							.then(function(){
								// NOTE: this will get called for all results 
								// 		including ones that generate errors, not 
								// 		sure if this is a bug in .denodeify(..) 
								// 		or by-design though...
								res.push(file)
								if(res.length == files.length){
									resolve()
								}
							})
					})
			})
		})
	}
}

// NOTE: this should work from a chrome app and does not require anything
// 		but fs access...
// XXX need a default for '/' on windows...
// XXX add '.' and '..' support...
var listDirBrowser = 
module.listDirBrowser =
function(path, make){
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path
	// XXX this is a bit fragile...
	path = /^file:\/\//.test(path.trim()) ? path : 'file:///'+path

	var fullpath = false

	$.get(path)
		// XXX
		.fail(function(err){
			console.log('!!!', arguments)
		})
		.done(function(data){
			// XXX this is very chrome specific...
			// look for: addRow(name, url, isdir, size, date_modified)
			$(data)
				.filter('script')
				.toArray()
				.forEach(function(e){
					e = e.innerHTML.split(/.*addRow\((.*)\);/g)
					if(e.length > 1){
						e.filter(function(e, i){ return i % 2 })
							.forEach(function(elem){
								elem = JSON.parse('['+elem+']')
								var file = elem[0]

								if(file == '..' || file == '.'){
									return
								}

								// do the build...
								make(fullpath 
									? path +'/'+ file 
									: file + (elem[2] ? '/' : ''))
							})
					}
				})
		})
}


//var listDir = module.listDir = listDirBrowser
//var listDir = module.listDir = listDirGlob
var listDir = module.listDir = listDirfs



/*********************************************************************/

// XXX for some reason pop does not focus the container dir correctly...
// 		...this is potentially due to the list not being ready yet...
// XXX this should be smarter and support other URL schemes...
var WalkPrototype = Object.create(browse.Browser.prototype)
WalkPrototype.options = {
	// XXX this should be smarter and support other URL schemes...
	pathPrefix: os.type() == 'Windows_NT' ? '' : '/',

	fullPathEdit: true,
	traversable: true,
	flat: false,

	sortTraversable: 'first',

	//actionButton: '&ctdot;',
	actionButton: '&odot;',
	pushButton: false,

	list: listDir,

	fileCountPattern: '*',

	disableFiles: false,

	// enable '.' and '..' dirs...
	dotDirs: true,
}
WalkPrototype.options.__proto__ = browse.Browser.prototype.options


var Walk = 
module.Walk = 
object.makeConstructor('Walk', 
		browse.Browser.__proto__, 
		WalkPrototype)


var makeWalk = 
module.makeWalk = function(elem, path, fileCountPattern, rest){
	var opts = {}
	if(rest){
		for(var k in rest){
			opts[k] = rest[k]
		}
	}

	opts.path = path

	opts.fileCountPattern = fileCountPattern == null ?
		WalkPrototype.options.fileCountPattern
		: fileCountPattern

	return Walk(elem, opts)
}



/*********************************************************************/

var makeGlobList = 
module.makeGlobList = function(elem, pattern, prepare){
	// XXX
}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
