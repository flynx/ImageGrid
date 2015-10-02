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

// XXX mostly works, this has trouble with drives...
var listDirfs = 
module.listDirfs =
function(path, make){
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path
	
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
// XXX for some reason this breaks with a 404...
var listDirBrowser = 
module.listDirBrowser =
function(path, make){
	path = path.constructor == Array ? path.join('/') : path
	path = /^[a-zA-Z]:/.test(path.trim()) ? path : '/'+path
	path = /^file:\/\//.test(path.trim()) ? path : 'file://'+path

	var fullpath = false

	$.get(path)
		// XXX
		.fail(function(err){
		})
		.done(function(data){

			// XXX this is chrome specific...
			// look for: addRow(name, url, isdir, size, date_modified)
			data
				.split(/.*addRow\(([^)]+)\)/g)
				// skip odd sections...
				.filter(function(e, i){ return i % 2 })
				// skip the columns...
				.slice(1)
				.forEach(function(elem){
					// get the data...
					elem = elem.split(',')
					var file = elem[0]
						// remove quotes...
						.replace(/.*(['"])([^\1]*)\1.*/, '$2')
						//.replace(/"([^"]+)"/, '$1')

					// do the build...
					make(fullpath 
						? path +'/'+ file 
						: file + (elem[2]*1 ? '/' : ''))
				})
		})
}


//var listDir = module.listDir = listDirBrowser
var listDir = module.listDir = listDirfs



/*********************************************************************/

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
