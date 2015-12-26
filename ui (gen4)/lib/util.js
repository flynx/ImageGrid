/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// convert JS arguments to Array...
var args2array =
module.args2array =
function(args){
	//return Array.apply(null, args)
	return [].slice.call(args)
}

// Quote a string and convert to RegExp to match self literally.
var quoteRegExp =
module.quoteRegExp =
function(str){
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
}


// XXX do we need to quote anything else???
var path2url =
module.path2url =
function(path){
	// test if we have a schema, and if yes return as-is...
	if(/^(http|https|file|[\w-]*):[\\\/]{2}/.test(path)){
		return path
	}
	// skip encoding windows drives...
	var drive = path.split(/^([a-z]:[\\\/])/i)
	path = drive.pop()
	drive = drive.pop() || ''
	return drive + (path
		.split(/[\\\/]/g)
		// XXX these are too aggressive...
		//.map(encodeURI)
		//.map(encodeURIComponent)
		.join('/')
		// NOTE: keep '%' the first...
		//.replace(/%/g, '%25')
		.replace(/#/g, '%23')
		.replace(/&/g, '%26'))
}


// NOTE: we are not using node's path module as we need this to work in
// 		all contexts, not only node... (???)
var normalizePath = 
module.normalizePath =
function(path){
	return typeof(path) == typeof('str') ? path
			// normalize the slashes...
			.replace(/(\/)/g, '/')
			// remove duplicate '/'
			.replace(/(\/)\1+/g, '/')
			// remove trailing '/'
			.replace(/\/+$/, '')
			// take care of .
			.replace(/\/\.\//g, '/')
			.replace(/\/\.$/, '')
			// take care of ..
			.replace(/\/[^\/]+\/\.\.\//g, '/')
			.replace(/\/[^\/]+\/\.\.$/, '')
		: path
}



/*********************************************************************/

// XXX experiment
jQuery.fn._drag = function(){
	var dragging = false
	var s, 
		px, py

	var elem = $(this)
		.on('mousedown touchstart', function(evt){
			dragging = true
			px = evt.clientX
			px = evt.clientY

			s = elem.rscale()
		})
		.on('mousemove touchmove', function(evt){
			if(!dragging){
				return
			}

			var x = evt.clientX 
			var dx = px - x
			px = x

			var y = evt.clientY 
			var dy = py - y
			py = y

			elem
				.velocity('stop')
				.velocity({
					translateX: '-=' + (dx / s),
					translateY: '-=' + (dy / s),
				}, 0)
		})
		.on('mouseup touchend', function(evt){
			dragging = false
			elem.velocity('stop')
		})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
