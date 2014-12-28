/**********************************************************************
* 
*
*
**********************************************************************/

var pathlib = require('path')
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
//
// Task
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
	return loadFile(path).then(JSON.parse)
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
// XXX test with:
// 		requirejs(['file'], function(m){ 
// 			m.loadIndex("L:/mnt/hdd15 (photo)/NTFS1/media/img/others")
// 				.on('index', function(){ console.log('!!!', arguments) }) })
var loadIndex =
module.loadIndex = 
function(path, emitter){
	var p = path.split(INDEX_DIR)
	var last = p.slice(-1)[0].trim()

	var end = emitter == null
	emitter = emitter == null ? new events.EventEmitter() : emitter

	// XXX to facilitate tracking this needs return an object that both
	// 		emits events (EventEmitter) and holds state (promise)...
	//return new promice(function(resolve, reject){
	//	// XXX
	//})

	// we've got an index...
	if(p.length > 1 && /^\/*$/.test(last)){
		listJSON(path)
			.on('end', function(files){
				var res = {}
				var index = {}
				var root = {}

				// group by keyword...
				files
					.sort()
					.reverse()
					.forEach(function(n){
						var b = pathlib.basename(n)
						var s = b.split(/[-.]/g).slice(0, -1)

						// <keyword>.json / non-diff
						// NOTE: this is a special case, we add this to
						// 		a seporate index and then concat it to 
						// 		the final list if needed...
						if(s.length == 1){
							var k = s[0]
							root[k] = n 
							return

						// <timestamp>-<keyword>[-diff].json / diff / non-diff
						} else {
							var k = s[1]
							var d = s[2] == 'diff'
						}

						// new keyword...
						if(index[k] == null){
							index[k] = [[d, n]]
							emitter.emit('queued', n)

						// do not add anything past the latest non-diff 
						// for each keyword...
						} else if(index[k].slice(-1)[0][0] == true){
							index[k].push([d, n])
							emitter.emit('queued', n)
						}
					})

				// add root files where needed...
				Object.keys(root).forEach(function(k){
					var n = root[k]

					// no diffs...
					if(index[k] == null){
						index[k] = [[false, n]]
						emitter.emit('queued', n)

					// add root file if no base is found...
					} else if(index[k].slice(-1)[0][0] == true){
						index[k].push([false, n])
						emitter.emit('queued', n)
					}
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
											// load diff...
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
					}))
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


		listIndexes(path)
			.on('end', function(indexes){
				var i = indexes.length

				// collect the found indexes...
				emitter.on('index', function(path, obj){ 
					i -= 1
					res[path] = obj 

					if(i <= 0){
						// XXX need to call this when the load was done...
						emitter.emit('end', res)
					}
				})

				indexes.forEach(function(path){ loadIndex(path, emitter) })

			})
	}

	return emitter
}
 



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
