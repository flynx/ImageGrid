/**********************************************************************
* 
*
*
**********************************************************************/

var glob = require('glob')
var path = require('path')


define(function(require){ var module = {}
console.log('>>> file')

//var DEBUG = DEBUG != null ? DEBUG : true

var tasks = require('lib/tasks')



/*********************************************************************/

var INDEX_DIR = '.ImageGrid'


/*********************************************************************/

function listIndexes(base){
	return glob(base +'/**/'+ INDEX_DIR)
}


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
