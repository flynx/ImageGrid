/**********************************************************************
* 
*
*
**********************************************************************/

var path = require('path')
var events = require('events')

var fse = require('fs.extra')
var glob = require('glob')
var promise = require('promise')


define(function(require){ var module = {}
console.log('>>> file')

//var DEBUG = DEBUG != null ? DEBUG : true

var tasks = require('lib/tasks')



/*********************************************************************/

var INDEX_DIR = '.ImageGrid'


/*********************************************************************/
// Queue
// 	.enqueue(func)
// 	.enqueue(task)
//
// 	.start()
// 	.stop()
//
//	.state
//	.size				- running pool size
//
//
// Task
// 	.start(..)
// 	.stop()
//
// 	.done(..)
// 	.fail(..)
//
//	.state
//
// Task()
// Task(val)
// Task(val, ...)
// Task([val, ...])
//
// NOTE: val can be a function or a value...
// 		...if value is a promise or a deferred then the task is linked 
// 		to that, and is not startable or resumable...
//
//




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
//
//
// Might also be a nice idea to generic import:
//	- get all .ImageGrid/*.json
//	- group by ([a-z]*).* — pattern with <keyword>
//	- sort by name, descending
//	- split at first non-diff
//	- merge diff's in reverse tail to head
// 
// ...and output to format:
// 	{
// 		<keyword>: <data>,
// 		...
// 	}
//

// XXX return a promice rather than an event emitter....
function listIndexes(base){
	return glob(base +'/**/'+ INDEX_DIR)
}


// XXX return a promice rather than an event emitter....
function listJSON(path, pattern){
	pattern = pattern || '*'
	return glob(path +'/'+ pattern +'.json')
}


var loadFile = promise.denodeify(fse.readFile)
function loadJSON(path){
	return readFile(path).then(JSON.parse)
}


// json file name format:
// 	[<timestamp>-]<keyword>[-diff].json
//
// events emited:
// 	- queued <path>			- json file path queued for loading
// 	- loaded <path>			- done loading json file path
// 	- index <path> <data>	- done loding index at path
// 	- end <indexes>			- done loading all indexes
//
// XXX return a promice rather than an event emitter....
function loadIndex(path, emitter){
	var p = path.split(INDEX_DIR)
	var last = p.slice(-1)[0].trim()

	var end = emitter == null
	emitter = emitter == null ? new events.EventEmitter() : emitter

	// we've got an index...
	if(p.length > 1 && /^\/*$/.test(last)){
		listJSON(path)
			.on('end', function(files){
				var res = {}
				var index = {}
				// group by keyword...
				files
					.sort()
					.reverse()
					.forEach(function(n){
						var s = n.split(/[-.]/g).slice(0, -1)

						// <keyword>.json / non-diff
						if(s.length == 1){
							var k = s[0]
							var d = false

						// <timestamp>-<keyword>[-diff].json / diff / non-diff
						} else {
							var k = s[1]
							var d = s[2] == 'diff'
						}

						// new keyword...
						if(index[k] == null){
							index[k] = []

						// do not add anything past the latest non-diff 
						// for each keyword...
						} else if(index[k].slice(-1)[0][0] == false){
							index[k].push([d, n])
							emitter.emit('queued', n)
							return
						}

						index[k].push([d, n])
						emitter.emit('queued', n)
					})

				// load...
				promise
					.all(Object.keys(index).map(function(k){
						// get relevant paths...
						var diffs = index[k]
						var latest = diffs.splice(-1)[0][1]

						// load latest...
						return loadJSON(latest)
							.then(function(data){
								// handle diffs...
								return promise
									.all(diffs
										.reverse()
										.map(function(p){
											p = p[1]
											return loadJSON(p)
												.done(function(json){
													// merge...
													for(var k in json){
														data[k] = json[k]
													}

													emitter.emit('loaded', p)
												})
										}))
									.then(function(){
										res[k] = data

										emitter.emit('loaded', latest)
									})
							})
					})
					.then(function(){
						emitter.emit('index', path, res)

						// indicate end only if we are not part of a multi-index load...
						if(end){
							emitter.emit('end', {path: res})
						}
					})
			})

	// no explicit index given -- find all in sub tree...
	} else {
		var res = {}

		// collect the found indexes...
		emitter.on('index', function(path, obj){ res[path] = obj })

		listIndexes(path)
			.on('end', function(indexes){
				indexes.forEach(function(path){ loadIndex(path, emitter) })

				// XXX need to call this when the load was done...
				emitter.emit('end', res)
			})
	}

	return emitter
}
 



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
