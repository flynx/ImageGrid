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
// things we need...
// 	- load latest by pattern
// 	- merge
// 		- load latest base
// 		- merge diffs later than base
// 	- find index(s) in subtree
// 	- load index
// 		- data version
// 	- join indexes
// 		- take care of different base paths in images
//

function listIndexes(base){
	return glob(base +'/**/'+ INDEX_DIR)
}


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
