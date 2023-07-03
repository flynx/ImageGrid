/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var types = require('lib/types')
module.patchDate = types.patchDate



//---------------------------------------------------------------------
// Misc...

module.chainCmp = function(cmp_chain){
	return function(a, b, get, data){
		var res
		for(var i=0; i < cmp_chain.length; i++){
			res = cmp_chain[i](a, b, get, data)
			if(res != 0){
				return res } }
		return res } } 


// XXX do we need to quote anything else???
var path2url =
module.path2url =
function(path){
	// test if we have a schema, and if yes return as-is...
	if(/^(data|http|https|file|[\w-]*):[\\\/]{2}/.test(path)){
		return path }
	// skip encoding windows drives...
	path = path
		.split(/[\\\/]/g)
	var drive = path[0].endsWith(':') ?
		path.shift() + '/'
		: ''
	return drive + (path
		// XXX these are too aggressive...
		//.map(encodeURI)
		//.map(encodeURIComponent)
		.join('/')
		// NOTE: keep '%' the first...
		.replace(/%/g, '%25')
		.replace(/#/g, '%23')
		.replace(/&/g, '%26')) }


// NOTE: we are not using node's path module as we need this to work in
// 		all contexts, not only node... (???)
var normalizePath = 
module.normalizePath =
function(path){
	return typeof(path) == typeof('str') ? path
			// normalize the slashes...
			.replace(/\\/g, '/')
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
		: path }




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
