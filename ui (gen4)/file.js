/**********************************************************************
* 
*
*
**********************************************************************/

var pathlib = require('path')
var events = require('events')

var fse = require('fs.extra')
var glob = require('glob')
var Promise = require('promise')

var guaranteeEvents = require('guarantee-events')


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
// helpers...

// Guarantee that the 'end' and 'match' handlers will always get called 
// with all results at least once...
//
// This does two things:
// 	- every 'end' event handler will get the full result set, regardless
// 		of when it was set...
// 	- every 'match' handler will be called for every match found, again
// 		regardless of whether it was set before or after the time of 
// 		match.
//
// This prevents handlers from missing the event they are waiting for, 
// essentially making it similar to how Promise/Deferred handle their
// callbacks.
//
var guaranteeGlobEvents =
module.guaranteeGlobEvents =
function(glob){ return guaranteeEvents('match end', glob) }



/*********************************************************************/
// Reader...


// XXX return a promise rather than an event emitter (???)
// XXX glob has a problem: if a match happens fast enough and we are slow
// 		enough to register a 'match' handler, then that match(s) will get
// 		missed...
function listIndexes(base){
	return guaranteeGlobEvents(glob(base +'/**/'+ INDEX_DIR))
}


// XXX return a promise rather than an event emitter (???)
function listJSON(path, pattern){
	pattern = pattern || '*'
	return guaranteeGlobEvents(glob(path +'/'+ pattern +'.json'))
}


var loadFile = Promise.denodeify(fse.readFile)


// XXX handle errors...
function loadJSON(path){
	return loadFile(path).then(JSON.parse)
}


// Load index(s)...
//
//	loadIndex(path)
//		-> data
//
//	loadIndex(path, logger)
//		-> data
//
//
// Procedure:
// 	- locate indexes in path given
// 	- per each index
// 		- get all .json files
// 		- get and load latest base file per keyword
// 		- merge all later than loaded base diff files per keyword
//
//
// Index format (input):
// 	.ImageGrid/
// 		+- [<timestamp>-]<keyword>[-diff].json
// 		+- ...
//
//
// Output format:
// 	{
// 		// one per index found...
// 		<path>/<sub-path>: {
// 			<keyword>: <kw-data>,
// 			...
// 		},
// 		...
// 	}
//
//
// Events emitted on logger if passed:
// 	- queued <path>			- json file path queued for loading
// 	- loaded <path>			- done loading json file path
// 	- index <path> <data>	- done loading index at path
// 	- error <err>			- an error occurred...
//
//
// XXX test with:
// 		requirejs(['file'], 
// 			function(m){ 
// 				f = m.loadIndex("L:/mnt/hdd15 (photo)/NTFS1/media/img/others") })
// 			.done(function(d){ console.log(d) })
// XXX need to do better error handling...
// XXX a bit overcomplicated (???), see if this can be split into more generic 
// 		sections...
var loadIndex =
module.loadIndex = 
function(path, logger){
	var p = path.split(INDEX_DIR)
	var last = p.slice(-1)[0].trim()

	return new Promise(function(resolve, reject){
		// we've got an index...
		if(p.length > 1 && /^\/*$/.test(last)){
			listJSON(path)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
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
								logger && logger.emit('queued', n)

							// do not add anything past the latest non-diff 
							// for each keyword...
							} else if(index[k].slice(-1)[0][0] == true){
								index[k].push([d, n])
								logger && logger.emit('queued', n)
							}
						})

					// add base files back where needed...
					Object.keys(root)
						.forEach(function(k){
							var n = root[k]

							// no diffs...
							if(index[k] == null){
								index[k] = [[false, n]]
								logger && logger.emit('queued', n)

							// add root file if no base is found...
							} else if(index[k].slice(-1)[0][0] == true){
								index[k].push([false, n])
								logger && logger.emit('queued', n)
							}
						})

					// load...
					Promise
						.all(Object.keys(index).map(function(k){
							// get relevant paths...
							var diffs = index[k]
							var latest = diffs.splice(-1)[0][1]

							// NOTE: so far I really do not like how nested and
							// 		unreadable the Promise/Deferred code becomes
							// 		even with a small rise in complexity...
							// 		...for example, the following code is quite
							// 		simple, but does not look the part.
							//
							// 		Maybe it's a style thing...

							// load latest...
							return loadJSON(latest)
								.then(function(data){
									// handle diffs...
									return Promise
										.all(diffs
											.reverse()
											.map(function(p){
												p = p[1]
												// load diff...
												return loadJSON(p)
													// XXX handle errors...
													// XXX we should abort loading this index...
													.catch(function(err){
														logger && logger.emit('error', err)
													})
													.done(function(json){
														// merge...
														for(var k in json){
															data[k] = json[k]
														}

														logger && logger.emit('loaded', p)
													})
											}))
										.then(function(){
											res[k] = data

											logger && logger.emit('loaded', latest)
										})
								})
						}))
						.then(function(){
							logger && logger.emit('index', path, res)

							var d = {}
							d[path] = res

							resolve(d)
						})
				})

		// no explicit index given -- find all in sub tree...
		} else {
			var res = {}

			// XXX handle 'error' event...
			listIndexes(path)
				// XXX handle errors...
				.on('error', function(err){
					logger && logger.emit('error', err)
				})
				// collect the found indexes...
				.on('match', function(path){
					loadIndex(path, logger) 
						.done(function(obj){ res[path] = obj[path] })
				})
				// done...
				.on('end', function(paths){
					resolve(res)
				})
		}
	})
}
 


/*********************************************************************/
// Writer...




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
