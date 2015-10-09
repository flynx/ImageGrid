/**********************************************************************
* 
*
*
**********************************************************************/

var fs = require('fs')
var path = require('path')
var walk = require('glob')
var guaranteeEvents = require('guarantee-events')

define(function(require){ var module = {}
console.log('>>> browse-walk')

//var DEBUG = DEBUG != null ? DEBUG : true

var object = require('../../object')
var browse = require('./browse')


/*********************************************************************/
// XXX need a root management to do OS-specific root dir management...
// 		e.g. X:/.. and /Volume/..

// XXX mostly works, does not list drive letter root dirs, deeper paths 
// 		work...
var listDirGlob = 
module.listDirGlob =
function(path, make){
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path

	// if not a glob then just list contents...
	var fullpath = path.indexOf('*') >= 0
	path = path.indexOf('*') < 0 ? path + '/*' : path

	guaranteeEvents([
			'match',
			'error',
		], 
		glob.glob(path))
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
			// XXX finalize...
			// 		...and do this after all the stats are done...
			.on('end', function(){
			})
}

var listDirfs = 
module.listDirfs =
function(path, make){
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path
	// XXX the windows root path must have a trailing '/'
	path = /^[a-zA-Z]:$/.test(path.trim()) ? path+'/' : path

	var fullpath = false

	fs.readdir(path, function(err, files){
		// XXX
		if(err){
			return
		}

		files.forEach(function(file){
			fs.stat(path +'/'+ file, function(err, stat){
				if(err){
					make(fullpath 
						? path +'/'+ file 
						: file, null, true)
				} else {
					make(fullpath 
						? path +'/'+ file 
						: file + (stat.isDirectory() ? '/' : ''))
				}
			})
		})
	})
}

// NOTE: this should work from a chrome app and does not require anything
// 		but fs access...
// XXX need a default for '/' on windows...
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
var listDir = module.listDir = listDirfs



/*********************************************************************/

// XXX for some reason pop does not focus the container dir correctly...
// 		...this is potentially due to the list not being ready yet...
var WalkPrototype = Object.create(browse.Browser.prototype)
WalkPrototype.options = {

	fullPathEdit: true,
	traversable: true,
	flat: false,

	list: listDir,
}
WalkPrototype.options.__proto__ = browse.Browser.prototype.options


var Walk = 
module.Walk = 
object.makeConstructor('Walk', 
		browse.Browser.__proto__, 
		WalkPrototype)


var makeWalk = 
module.makeWalk = function(elem, path){
	//return Walk(elem, { path: path })
	var w = Walk(elem, { path: path })
	console.log(w)
	return w
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
