/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(process) != 'undefined'){
	var pathlib = requirejs('path')
	var events = requirejs('events')

	var fse = requirejs('fs-extra')

	var glob = requirejs('glob')
	var wglob = requirejs('wildglob')

	var guaranteeEvents = requirejs('guarantee-events')

} else {
	return module }

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var util = require('lib/util')



/*********************************************************************/

var INDEX_DIR = '.ImageGrid'



/*********************************************************************/
// helpers...

// Skip nested indexes from tree...
//
var skipNested = 
module.skipNested =
function(paths, index_dir, logger){
	index_dir = index_dir || INDEX_DIR
	logger = logger && logger.push('Skipping nested')
	paths = paths
		.map(function(p){ 
			return p.split(index_dir).shift() })
		.sort(function(a, b){ 
			return a.length - b.length })
	for(var i=0; i < paths.length; i++){
		var p = paths[i]
		if(p instanceof Array){
			continue }
		for(var j=i+1; j < paths.length; j++){
			if(paths[j] instanceof Array){
				continue }
			var o = paths[j].split(p)
			if(o[0] == '' && o.length > 1){
				logger && logger.emit('skipping', paths[j])
				paths[j] = [] } } }
	return paths.flat() }


// Guarantee that the 'end' and 'data' handlers will always get called 
// with all results at least once...
//
// This does two things:
// 	- every 'end' event handler will get the full result set, regardless
// 		of when it was set...
// 	- every 'data' handler will be called for every match found, again
// 		regardless of whether it was set before or after the time of 
// 		match.
//
// This prevents handlers from missing the event they are waiting for, 
// essentially making it similar to how Promise/Deferred handle their
// callbacks.
//
// XXX ASAP: end event arguments changed -- need to collect the list of 
// 		matches manually...
var guaranteeGlobEvents =
module.guaranteeGlobEvents =
function(glob){ 
	return guaranteeEvents('data end', glob) }

var gGlob = 
module.gGlob = function(){
	return guaranteeGlobEvents(
		glob.globStream.apply(null, arguments)) }



/*********************************************************************/
// Reader...


// XXX would be nice to find a way to stop searching a sub tree as soon
// 		as a match is found.
// 		...this would be allot faster than getting the whole tree and 
// 		then pruning through like it is done now...
var listIndexes =
module.listIndexes = 
function(base, index_dir){
	return gGlob(base +'/**/'+ (index_dir || INDEX_DIR), {strict: false}) }


// NOTE: this is similar to listIndexes(..) but will return a promise and
// 		skip all non-loadable nested indexes...
var getIndexes =
module.getIndexes = 
function(base, index_dir, logger){
	logger = logger 
		&& logger.push('Searching')
	return new Promise(function(resolve, reject){
		var paths = []
		listIndexes(base, index_dir)
			.on('error', function(err){
				reject(err) })
			.on('data', function(path){
				logger 
					&& logger.emit('found', path) 
				paths.push(path) })
			.on('end', function(){
				// skip nested indexes...
				resolve(
					skipNested(paths, index_dir, logger)) }) }) }


var listPreviews =
module.listPreviews = 
function(base, img_pattern){
	//return gGlob(base +'/*px/*jpg')
	return gGlob(base +'/*px/'+(img_pattern || '*')+'.jpg', {strict: false}) }


// XXX return a promise rather than an event emitter (???)
var listJSON =
module.listJSON =
function(path, pattern){
	pattern = pattern 
		|| '*'
	path = util.normalizePath(path)
	return gGlob(path +'/'+ pattern +'.json', {strict: false}) }

// wrap a node style callback function into a Promise...
//
// NOTE: this is inspired by the promise module for node this stopped 
// 		working, and porting one method was simpler that trying to get
// 		to the bottom of the issue, especially with native promises...
// XXX move to someplace generic...
var denodeify = 
module.denodeify =
function(func){
	var that = this
	return function(){
		var args = [...arguments]
		return new Promise(function(resolve, reject){
			func.call(that, ...args, function(err, res){
				return err ? 
					reject(err) 
					: resolve(res) }) }) } }

var loadFile = denodeify(fse.readFile)
var writeFile = denodeify(fse.writeFile)
var ensureDir = denodeify(fse.ensureDir)


// XXX handle errors...
function loadJSON(path){
	return loadFile(util.normalizePath(path))
		.then(JSON.parse) }


// Format:
// 	{
// 		<date>: [
// 			<path>,
// 			...
// 		],
//
// 		...
//
// 		// root files -- no date...
// 		root: [
// 			<path>,
// 			...
// 		]
// 	}
//
// NOTE: this does not use the fs...
var groupByDate = 
module.groupByDate = 
function(list){
	var res = {}
	list
		.forEach(function(n){
			var b = pathlib.basename(n)
			var s = b.split(/[-.]/g).slice(0, -1)
			// no date set...
			if(s.length == 1){
				res.root = res.root 
					|| []
				res.root.push(n)
			} else {
				res[s[0]] = res[s[0]] 
					|| []
				res[s[0]].push(n) } })
	return res }



// Group file list by keyword...
//
// this will build a structure in the following format:
// 	{
// 		<keyword>: [
// 			// diff files...
// 			// NOTE: the first argument indicates 
// 			//	if this is a diff or not, used to 
// 			//	skip past the last base...
// 			[true, <filename>],
// 			...
//
// 			// base file (non-diff)
// 			[false, <filename>]
// 		],
// 		...
// 	}
//
// This is used to sequence, load and correctly merge 
// the found JSON files.
//
// NOTE: all files past the first non-diff are skipped.
// NOTE: this does not use the fs...
var groupByKeyword = 
module.groupByKeyword = 
function(list, from_date, logger){
	//logger = logger && logger.push('Grouping by keyword')

	var index = {}
	var queued = 0

	var dates = groupByDate(list)

	Object.keys(dates)
		.sort()
		.reverse()
		// skip dates before from_date...
		// NOTE: from_date is included...
		.filter(function(d){ 
			return from_date ? 
				d <= from_date 
					|| d == 'root' 
				: true })
		.forEach(function(d){
			dates[d]
				.sort()
				.reverse()
				.forEach(function(n){
					var b = pathlib.basename(n)
					var s = b.split(/[-.]/g).slice(0, -1)

					// <timestamp>-<keyword>[-diff].json / diff / non-diff
					// NOTE: all files without a timestamp are filtered out
					// 		by groupByDate(..) into a .root section so we 
					// 		do not need to worry about them here...
					var k = s[1]
					var d = s[2] == 'diff'

					k = d ? 
						k 
						: s.slice(1).join('-')

					// new keyword...
					if(index[k] == null){
						index[k] = [[d, n]]
						logger && logger.emit('queued', n)
						queued += 1
					// do not add anything past the latest non-diff 
					// for each keyword...
					} else if(index[k].slice(-1)[0][0] == true){
						index[k].push([d, n])
						logger && logger.emit('queued', n)
						queued += 1 } }) })
	// add base files back where needed...
	// <keyword>.json / non-diff
	;(dates.root || [])
		.forEach(function(n){
			var b = pathlib.basename(n)
			var k = b.split(/\./g)[0]
			// no diffs...
			if(index[k] == null){
				index[k] = [[false, n]]
				logger 
					&& logger.emit('queued', n)
				queued += 1
			// add root file if no base is found...
			} else if(index[k].slice(-1)[0][0] == true){
				index[k].push([false, n])
				logger 
					&& logger.emit('queued', n)
				queued += 1 } })
	// remove the flags...
	for(var k in index){
		index[k] = index[k]
			.map(function(e){ 
				return e[1] }) }
	logger 
		&& logger.emit('files-queued', queued, index)
	return index }



// Load index data listed by timestamp... 
//
// NOTE: this returns data similar to groupByDate(..) but will replace 
// 		the 'root' key with a timestamp...
// NOTE: this will include the full history. this is different to what
// 		groupByKeyword(..) does.
//
// XXX handle errors....
var loadSaveHistoryList =
module.loadSaveHistoryList =
function(path, index_dir, logger){
	logger = logger 
		&& logger.push('Save history')

	path = util.normalizePath(path)
	index_dir = index_dir 
		|| INDEX_DIR

	return new Promise(function(resolve, reject){
		// direct index...
		if(pathlib.basename(path) == index_dir){
			var files = []
			listJSON(path)
				// XXX handle errors...
				.on('error', function(err){
					logger 
						&& logger.emit('error', err)
					console.error(err) })
				.on('data', function(path){
					paths.push(path) })
				.on('end', function(){
					var data = groupByDate(files)
					// XXX should we mark the root timestamp in any way???
					if('root' in data 
							&& data.root.length > 0){
						// XXX handle stat error...
						data[fse.statSync(data.root[0]).birthtime.getTimeStamp()] = data.root
						delete data.root }
					resolve(data) })
		// need to locate indexes...
		} else {
			var res = {}
			getIndexes(path, index_dir, logger)
				.catch(function(err){
					logger 
						&& logger.emit('error', err)
					console.error(err) })
				.then(function(paths){
					// start loading...
					return Promise
						.all(paths.map(function(p){
							p = util.normalizePath(p)
							//var path = pathlib.normalize(p +'/'+ index_dir) 
							var path = util.normalizePath(p +'/'+ index_dir) 
							return loadSaveHistoryList(path, index_dir)
								.then(function(obj){ 
									// NOTE: considering that all the paths within
									// 		the index are relative to the preview 
									// 		dir (the parent dir to the index root)
									// 		we do not need to include the index 
									// 		itself in the base path...
									res[p] = obj }) })) })
				.then(function(){ 
					resolve(res) }) } }) }



// Load index(s)...
//
//	Load path (use default INDEX_DIR)...
//	loadIndex(path)
//	loadIndex(path, logger)
//		-> data
//
//	Load path with custom index_dir...
//	loadIndex(path, index_dir, logger)
//		-> data
//
//	Load from date...
//	loadIndex(path, index_dir, from_date, logger)
//		-> data
//
//	Load path as-is (do not search for index dir)...
//	loadIndex(path, false)
//	loadIndex(path, false, logger)
//		-> data
//
//	loadIndex(path, false, from_date, logger)
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
// Merging is done by copying the key-value pairs from diff to the
// resulting object.
//
//
// Index format (input):
// 	<index-dir>/
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
// 	- path <path>				- path currently being processed
// 	- files-found <n> <files>	- number and list of files found (XXX do we need this?)
// 	- queued <path>				- json file path queued for loading
// 	- files-queued <n> <queue>	- number of files queued and index (XXX do we need this?)
// 	- loaded <keyword> <path>	- done loading json file path
// 	- loaded <keyword>-diff <path>	
// 								- done loading json file path (diff file)
// 	- index <path> <data>		- done loading index at path
// 	- error <err>				- an error occurred...
//
//
//
// NOTE: this is fairly generic and does not care about the type of data
// 		or it's format as long as it's JSON and the file names comply
// 		with the scheme above...
// NOTE: this only loads the JSON data and does not import or process 
// 		anything...
//
// XXX need to do better error handling -- stop when an error is not recoverable...
// XXX really overcomplicated, mostly due to promises...
// 		...see if this can be split into more generic 
// 		sections...
// XXX change path handling:
// 		1) explicit index -- ends with INDEX_DIR (works)
// 			-> load directly...
// 		2) implicit index -- path contains INDEX_DIR (works)
// 			-> append INDEX_DIR and (1)...
// 		3) path is a pattern (contains glob wildcards) (works)
// 			-> search + load
// 		4) non of the above...
// 			a) error
// 			b) append '**' (current behavior)
// 			...(a) seems more logical...
// XXX do a task version...
var loadIndex =
module.loadIndex = 
function(path, index_dir, from_date, logger){
	logger = logger 
		&& logger.push('Index')

	path = util.normalizePath(path)

	if(index_dir 
			&& index_dir.emit != null){
		logger = index_dir
		index_dir = from_date = null

	} else if(from_date 
			&& from_date.emit != null){
		logger = from_date
		from_date = null }
	//index_dir = index_dir || INDEX_DIR
	index_dir = index_dir === false ? 
		index_dir 
		: (index_dir 
			|| INDEX_DIR)

	// XXX should this be interactive (a-la EventEmitter) or as it is now 
	// 		return the whole thing as a block (Promise)...
	// 		NOTE: one way to do this is use the logger, it will get
	// 				each index data on an index event
	return new Promise(function(resolve, reject){
		// prepare the index_dir and path....
		// NOTE: index_dir can be more than a single directory...
		var i = index_dir 
			&& util.normalizePath(index_dir).split(/[\\\/]/g)
		var p = util.normalizePath(path).split(/[\\\/]/g).slice(-i.length)

		var explicit_index_dir = !index_dir 
			|| (i
				.filter(function(e, j){ 
					return e == p[j] })
				.length == i.length)

		// we've got an index...
		// XXX do we need to check if it's a dir???
		if(explicit_index_dir){
			logger 
				&& logger.emit('path', path)

			var files = []
			listJSON(path)
				// XXX handle errors...
				.on('error', function(err){
					logger 
						&& logger.emit('error', err)
					console.error(err) })
				.on('data', function(path){
					files.push(path)})
				.on('end', function(){
					var res = {}
					var index = groupByKeyword(files, from_date, logger)
					// load...
					Promise
						.all(Object.keys(index).map(function(keyword){
							// get relevant paths...
							var diffs = index[keyword]
							var latest = diffs.splice(-1)[0]

							// XXX not sure about this...
							if(keyword == '__dates'){
								res.__dates = index.__dates
								return true }
							if(keyword == '__date'){
								res.__date = index.__date
								return true }

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
									logger && logger.emit('loaded', keyword, latest)

									var loading = {}
									// handle diffs...
									return Promise
										// load diffs...
										.all(diffs.map(function(p){
											return loadJSON(p)
												// XXX handle errors...
												// XXX we should abort loading this index...
												.catch(function(err){
													logger && logger.emit('error', err)
													console.error(err) })
												.then(function(json){
													// NOTE: we can't merge here
													// 		as the files can be
													// 		read in arbitrary order...
													loading[p] = json }) }))
										// merge diffs...
										.then(function(){
											diffs
												.reverse()
												.forEach(function(p){
													var json = loading[p]
													for(var n in json){
														data[n] = json[n] }
													logger 
														&& logger.emit('loaded', keyword+'-diff', p) })
											res[keyword] = data }) }) }))
						.then(function(){
							logger 
								&& logger.emit('index', path, res)
							var d = {}
							d[path] = res
							resolve(d) }) })
		// no explicit index given -- find all in sub tree...
		} else {
			var res = {}
			// special case: root index...
			if(fse.existsSync(path +'/'+ index_dir)){
				var n = path +'/'+ index_dir

				return loadIndex(n, index_dir, from_date, logger) 
					.then(function(obj){ 
						// NOTE: considering that all the paths within
						// 		the index are relative to the preview 
						// 		dir (the parent dir to the index root)
						// 		we do not need to include the index 
						// 		itself in the base path...
						res[path] = obj[n] 
						resolve(res) }) }
			// full search...
			getIndexes(path, index_dir, logger)
				.catch(function(err){
					logger && logger.emit('error', err)
					console.error(err) })
				.then(function(paths){
					// start loading...
					Promise
						.all(paths.map(function(p){
							p = util.normalizePath(p)
							//var path = pathlib.normalize(p +'/'+ index_dir) 
							var path = util.normalizePath(p +'/'+ index_dir) 
							return loadIndex(path, index_dir, from_date, logger) 
								.then(function(obj){ 
									// NOTE: considering that all the paths within
									// 		the index are relative to the preview 
									// 		dir (the parent dir to the index root)
									// 		we do not need to include the index 
									// 		itself in the base path...
									res[p] = obj[path] }) }))
						.then(function(){ 
							resolve(res) }) }) } }) }
 

// get/populate the previews...
//
// format:
// 	{
// 		<index-base>: {
// 			<gid>: {
// 				<resolution>: <local-path>,
// 				...
// 			},
// 			...
// 		},
// 		...
// 	}
//
// XXX should this be compatible with loadIndex(..) data???
// XXX handle errors....
var loadPreviews =
module.loadPreviews =
function(base, pattern, previews, index_dir, absolute_path){
	previews = previews 
		|| {}
	index_dir = index_dir 
		|| INDEX_DIR
	base = util.normalizePath(base)
	pattern = pattern 
		|| '*'

	// we got an explicit index....
	if(pathlib.basename(base) == index_dir){
		return new Promise(function(resolve, reject){
			if(!(base in previews)){
				previews[base] = {} }
			var images = previews[base]
			listPreviews(base, pattern)
				// XXX handle errors....
				//.on('error', function(err){
				//})
				// preview name syntax:
				// 	<res>px/<gid> - <orig-filename>.jpg
				.on('data', function(path){
					// get the data we need...
					var gid = pathlib.basename(path).split(' - ')[0]
					var res = pathlib.basename(pathlib.dirname(path))
					// build the structure if it does not exist...
					if(!(gid in images)){
						images[gid] = {} }
					if(images[gid].preview == null){
						images[gid].preview = {} }
					// add a preview...
					// NOTE: this will overwrite a previews if they are found in
					// 		several locations...
					images[gid].preview[res] =
						util.normalizePath(index_dir +'/'+ path.split(index_dir)[1]) })
				.on('end', function(){
					resolve(previews) }) })
	// find all sub indexes...
	} else {
		return new Promise(function(resolve, reject){
			var queue = []
			listIndexes(base, index_dir)
				// XXX handle errors....
				//.on('error', function(err){
				//})
				.on('data', function(base){
					queue.push(
						loadPreviews(base, pattern, previews, index_dir, absolute_path)) })
				.on('end', function(){
					Promise.all(queue)
						.then(function(){
							resolve(previews) }) }) }) } }


// XXX
var copyPreviews =
module.copyPreviews = 
function(){
	// XXX
}



/*********************************************************************/
// Builder...
// 	- read list
// 	- generate previews (use config)
// 	- build images/data
// 		.loadURLs(..)
// 	- write (writer)



/*********************************************************************/
// Writer...
//
// This is just like the loader, done in two stages:
// 	- format dependent de-construction (symetric to buildIndex(..))
// 	- generic writer...
//
// NOTE: for now we'll stick to the current format...

var FILENAME = '${DATE}-${KEYWORD}.${EXT}'

// NOTE: keyword in index can take the form <path>/<keyword>, in which 
// 		case the keyword will be saved to the <path>/<file-format>
// 		NOTE: loadIndex(..) at this point will ignore sub-paths...
var writeIndex =
module.writeIndex = 
function(json, path, date, filename_tpl, logger){
	logger = logger 
		&& logger.push('Index')

	// XXX get this from args/config...
	var spaces = null

	path = util.normalizePath(path)
	filename_tpl = filename_tpl 
		|| FILENAME
	// XXX for some reason this gets the unpatched node.js Date, so we 
	// 		get the patched date explicitly...
	date = date 
		|| window.Date.timeStamp()

	var files = []

	// build the path if it does not exist...
	return ensureDir(path)
		.catch(function(err){
			logger 
				&& logger.emit('error', err)
			console.error(err) })
		.then(function(){
			logger 
				&& logger.emit('path', path)

			// write files...
			// NOTE: we are not doing this sequencilly as there will not
			// 		be too many files...
			return Promise
				.all(Object.keys(json)
					.map(function(keyword){
						//var data = JSON.stringify(json[keyword])
						var data = JSON.stringify(json[keyword], null, spaces)

						// get the sub-path and keyword...
						var sub_path = keyword.split(/[\\\/]/g)
						keyword = sub_path.pop()
						sub_path = sub_path.join('/')

						var file = path +'/'+ sub_path +'/'+ (filename_tpl
							.replace('${DATE}', date)
							.replace('${KEYWORD}', keyword)
							.replace('${EXT}', 'json'))

						return ensureDir(pathlib.dirname(file))
							.then(function(){
								files.push(file)

								logger 
									&& logger.emit('queued', file)

								return writeFile(file, data, 'utf8')
									.catch(function(err){
										logger 
											&& logger.emit('error', err)
										console.error(err) })
									.then(function(){
										logger 
											&& logger.emit('written', file) }) }) }))
				.then(function(){
					logger 
						&& logger.emit('done', files) }) }) }



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
