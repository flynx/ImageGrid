/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')
var util = require('lib/util')
var actions = require('lib/actions')
var features = require('lib/features')

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')
var base = require('features/base')


//require('features/all')


if(typeof(process) != 'undefined'){
	var pathlib = requirejs('path')
	var argv = requirejs('lib/argv')
	var progress = requirejs('cli-progress')
	var colors = requirejs('colors') 

	var file = require('imagegrid/file') }



/*********************************************************************/

var CLIActions = actions.Actions({
	config: {
		// XXX do we care that something is not "ready" here???
		'declare-ready-timeout': 0,

		'progress-done-delay': 1000,

		banner: '$APPNAME $VERSION:',
	},


	// docs...
	//
	// XXX do a better set of examples...
	cliExamples: [[
		'Create/init index in current directory',
		'$ $SCRIPTNAME init',
		'',
		'Export 500px previews from current index to ./preview directory',
		'$ $SCRIPTNAME export from=. to=./previews --image-size=500',
	]],


	// the argvparser...
	//
	// this is set by argv's Parser on .onArgs(..) in .ready(..) handler below...
	argv: undefined,

	help: ['- System/Show action help',
		function(...actions){
			Object.entries(this.getDoc(actions))
				.forEach(function([action, [s, l]]){
					console.log(l)
					console.log('')
				}) }],

	get cliActions(){
		return this.actions
			.filter(function(action){
				return this.getActionAttr(action, 'cli') }.bind(this)) },

	// XXX should this be here???
	// 		...move this to progress...
	// XXX we are missing some beats, is this because we do not let the 
	// 		bar update before closing???
	// XXX need to reset this when done...
	__progress: null,
	showProgress: ['- System/',
		function(text, value, max){
			// progress display is disabled...
			if(this.__progress === false){
				return }

			var msg = text instanceof Array ? 
				text.slice(1).join(': ') 
				: null
			text = text instanceof Array ? 
				text[0] 
				: text

			var settings = this.__progress = this.__progress ?? {}
			var bars = settings.bars = settings.bars ?? {}
			var state = bars[text] = bars[text] ?? {}

			if(state.timeout){
				clearTimeout(state.timeout)
				delete state.timeout }

			// actions...
			if(value == 'reset'){
				// XXX this is not the same as ui-progress...
				// 		...here we first set timeout then and close, 
				// 		there we set to 0 and timeout and close...
				state.timeout = setTimeout(
					function(){
						//this.showProgress(text, 0, 0) }.bind(this),
						this.showProgress(text, 'close') }.bind(this),
					this.config['progress-done-delay'] || 1000)
				return }
			if(value == 'close'){
				delete bars[text]
				// check if no bars left...
				if(Object.keys(bars) == 0){
					delete this.__progress }
				return }

			var l = Math.max(text.length, settings.__text_length || 0)
			// length changed -> update the bars...
			l != settings.__text_length
				&& Object.entries(bars)
					.forEach(function([key, value]){
						value.bar
							&& value.bar.update({text: key.padEnd(l)}) })
			settings.__text_length = l

			// normalize max and value...
			value = state.value = 
				value != null ? 
					(typeof(value) == typeof('str') && /[+-][0-9]+/.test(value) ? 
						(state.value || 0) + parseInt(value)
						: value)
					: state.value
			max = state.max = 
				max != null ? 
					(typeof(max) == typeof('str') && /[+-][0-9]+/.test(max) ? 
						(state.max || 0) + parseInt(max)
						: max)
					: state.max

			var container = settings.__multi_bar = 
				settings.__multi_bar 
					|| (new progress.MultiBar({
								// XXX make this simpler...
								format: '{text}  {bar} {percentage}% '
									+'| ETA: {eta_formatted} | {value}/{total}',
								autopadding: true,
								stopOnComplete: true,
								forceRedraw: true,
							},
							progress.Presets.rect)
						// prepare for printing stuff...
						.run(function(){
							this.on('redraw-pre', function(){
								// XXX need to clear the line -- need to get term-width....
								// XXX this requires a full draw (forceRedraw: true)...
								//console.log('moo'.padEnd(process.stdout.columns))
							}) }))
			var bar = state.bar = 
				state.bar 
					|| container.create(0, 0, {text: text.padEnd(l)})

			// XXX for some reason this does not work under electron...
			bar.setTotal(Math.max(max, value))
			bar.update(value) 

			// auto-clear when complete...
			if(value >= max){
				state.timeout = setTimeout(
					function(){
						this.showProgress(text, 'close') }.bind(this), 
					this.config['progress-done-delay'] || 1000) } }],

	// handle logger progress...
	// XXX reset is called at odd spots by the queue handler (see: features/core.js)
	// XXX this is a copy from ui-progress -- need to reuse if possible...
	handleLogItem: ['- System/',
		function(logger, path, status, ...rest){
			var msg = path.join(': ')
			var l = (rest.length == 1 && rest[0] instanceof Array) ?
				rest[0].length
				: rest.length

			// only pass the relevant stuff...
			var attrs = {}
			logger.ondone 
				&& (attrs.ondone = logger.ondone)
			logger.onclose 
				&& (attrs.onclose = logger.onclose)

			// get keywords...
			var {add, done, skip, reset, close, error} = 
				this.config['progress-logger-keywords'] 
				|| {}
			// setup default aliases...
			add = new Set([...(add || []), 'added'])
			done = new Set([...(done || [])])
			skip = new Set([...(skip || []), 'skipped'])
			reset = new Set([...(reset || [])])
			close = new Set([...(close || []), 'closed'])
			error = new Set([...(error || [])])

			// close...
			if(status == 'close' || close.has(status)){
				this.showProgress(path, 'close')
			// reset...
			// XXX this seems to be called before "Cache image metadata" is done
			// 		when called from .cliInitIndex(..) -- messing up the numbers...
			} else if(status == 'reset' || reset.has(status)){
				this.showProgress(path, 'reset')
			// added new item -- increase max...
			// XXX show msg in the progress bar???
			} else if(status == 'add' || add.has(status)){
				this.showProgress(path, '+0', '+'+l)
			// resolved item -- increase done... 
			} else if(status == 'done' || done.has(status)){
				this.showProgress(path, '+'+l)
			// skipped item -- increase done... 
			// XXX should we instead decrease max here???
			// 		...if not this is the same as done -- merge...
			} else if(status == 'skip' || skip.has(status)){
				this.showProgress(path, '+'+l)
			// error...
			// XXX STUB...
			} else if(status == 'error' || error.has(status)){
				this.showProgress(['Error'].concat(msg), '+0', '+'+l) }
		}],

	// XXX SETUP revise default...
	setupFeatures: ['- System/',
		core.doc`Load required features.
			
			NOTE: this is hete because cli is designed to be loaded in a very
				limited context and for some actions will need additional
				features.
			`,
		function(...tags){
			var features = this.features.FeatureSet
			requirejs('features/all')
			features.setup(this, [
				'imagegrid-testing', 
				...(tags.length == 0 ?
					this.features.input
					: tags),
			]) }],
	setupGlobals: ['- System/',
		function(){
			// setup the global ns...
			global.ig =
			global.ImageGrid = 
				this
			global.help = function(...actions){
				global.ig.help(...actions) }
			global.ImageGridFeatures = core.ImageGridFeatures }],


	// basic code runner...
	cliDo: ['- System/CLI/run CODE', 
		{cli: {
			name: '@do',
			arg: 'CODE',
		}},
		function(code){
			var AsyncFunction = (async function(){}).constructor

			this.setupFeatures()
			this.setupGlobals()

			AsyncFunction(code)()

			this.stop() }],

	// Interactive commands...
	//
	cliStartREPL: ['- System/CLI/start CLI interpreter',
		{cli: {
			name: '@repl',
			arg: 'PATH'
			//interactive: true,
		}},
		function(path, options){
			var that = this
			var package = nodeRequire('./package.json')

			// XXX SETUP
			this.setupFeatures()

			if(path){
				this.loadIndex(path) }

			this.__keep_running = true

			this.setupGlobals()

			// start non-tty / script mode...
			if(!process.stdin.isTTY){
				var fs = nodeRequire('fs')
				var AsyncFunction = (async function(){}).constructor

				AsyncFunction(
					fs.readFileSync(process.stdin.fd, 'utf-8'))()
				this.stop()

			// start repl mode...
			} else {
				var repl = nodeRequire('repl')
				// print banner...
				var banner = this.banner 
					|| this.config.banner
				banner
					&& process.stdin.isTTY
					&& process.stdout.isTTY
					&& console.log(banner 
						.replace(/\$APPNAME/g, package.name)
						.replace(/\$AUTHOR/g, package.author)
						.replace(/\$REPO/g, package.repository)
						.replace(/\$SCRIPTNAME/g, this.argv.scriptName)
						.replace(/\$VERSION/g, this.version))

				// start the repl...
				repl
					.start({
						prompt: 'ig> ',
						useGlobal: true,
						input: process.stdin,
						output: process.stdout,
					})
					.on('exit', function(){
						that.stop() }) } }],
	// XXX move this to a feature that requires electron...
	// 		...and move electron to an optional dependency...
	cliStartGUI: ['- System/CLI/start viewer GUI',
		core.doc`

		NOTE: this will not wait for the viewer to exit.`,
		{cli: argv && argv.Parser({
			key: '@gui',
			arg: 'PATH',
			doc: 'start viewer GUI',

			'-version': undefined,
			'-quiet': undefined,

			'-devtools': {
				doc: 'show DevTools',
				type: 'bool',
			},
			'-show': {
				doc: 'force show interface',
				type: 'bool',
			},
		})},
		function(path, options={}){
			var env = { ...process.env }
			path
				&& (env.IMAGEGRID_PATH = 
					util.normalizePath(
						pathlib.resolve(process.cwd(), path)))
			options.devtools
				&& (env.IMAGEGRID_DEBUG = true)
			options.show
				&& (env.IMAGEGRID_FORCE_SHOW = true)

			// already in electron...
			if(process.versions.electron){
				// XXX this feels hackish... 
				global.START_GUI = true

			// launch gui...
			} else {
				requirejs('child_process')
					.spawn(requirejs('electron'),
						[ pathlib.join(
							pathlib.dirname(nodeRequire.main.filename), 
							'e.js') ],
						{ 
							detached: true, 
							env,
						}) } }],

	// XXX
	cliGID: ['- System/GLI/generate GID',
		{cli: {
			name: '@gid',
			arg: 'IMAGE',
			valueRequired: true,

			// XXX REMOVE WHEN DONE...
			doc: false,
		}},
		function(path){
			// XXX
			console.warn('Not implemented yet...')
		}],
	cliListIndexes: ['- System/CLI/list indexes in PATH',
		{cli: argv && argv.Parser({
			key: '@ls', 
			arg: 'PATH',
			doc: 'list indexes in PATH',

			'-version': undefined,
			'-quiet': undefined,

			'-r': '-recursive',
			'-recursive': {
				doc: 'list nested/recursive indexes',
				type: 'bool',
			},

			'-n': '-nested-only',
			'-nested-only': {
				doc: 'ignore the top-level index and only list the indexes below',
				type: 'bool',
			},

		})},
		function(path, options={}){
			var that = this
			path = path ?? '.'
			// needed to get the default index dir name...
			this.setupFeatures('fs')
			//this.setupFeatures()
			file.listIndexes(path)
				.on('end', function(paths){
					paths = paths
						.map(function(p){
							return p
								.split(that.config['index-dir'])
								.shift() })
					// normalize path...
					path.at(-1) != '/'
						&& (path += '/')
					// handle --nested-only
					options['nested-only']
						&& paths.includes(path)
						&& paths.splice(paths.indexOf(path), 1)
					paths = options.recursive ? 
						paths
						: file.skipNested(paths)
							.sortAs(paths)
					for(var p of paths){
						console.log(p) } }) }],

	// XXX check if index exists:
	// 			yes: warn + stup
	// 			no: create
	// 		...add -f/-force flag...
	// XXX metadata caching and preview creation are not in sync, can 
	// 		this be a problem???
	// 		...if not, add a note...
	// XXX should we support creating multiple indexes at the same time???
	// XXX this is reletively generic, might be useful globally...
	// XXX should we use a clean index or do this in-place???
	// XXX add ability to disable sort...
	cliInitIndex: ['- System/CLI/make index',
		core.doc`

			Create index in current directory
			.cliInitIndex()
			.cliInitIndex('create')
				-> promise

			Create index in path...
			,cliInitIndex(path)
			.cliInitIndex('create', path)
				-> promise


			Update index in current directory
			.cliInitIndex('update')
				-> promise

			Update index in path...
			.cliInitIndex('update', path)
				-> promise

		`,
		{cli: {
			name: '@init',
			arg: 'PATH',
			//valueRequired: true,
		}},
		function(path, options){
			// XXX SETUP
			this.setupFeatures()

			// get mode...
			if(path == 'create' || path == 'update'){
				var [mode, path, options] = arguments }
			mode = mode || 'create'
			// normalize path...
			path = util.normalizePath(
				path ?
					pathlib.resolve(process.cwd(), path)
					: process.cwd())
			options = options || {}

			// XXX should we use a clean index or do this in-place???
			//var index = this.constructor(..)
			var index = this
			return (mode == 'create' ?
					index.loadImages(path)
					: index.loadNewImages(path))
				// save base index...
				.then(function(){ 
					return index.saveIndex() })
				// sharp stuff...
				.then(function(){
					if(index.makePreviews){
						return Promise.all([
							// NOTE: no need to call .cacheMetadata(..) as 
							// 		it is already running after .loadImages(..)
							// XXX BUG: for some reason this reports making previews 
							// 		but does not actually make them...
							// XXX .makePreviews(..) called from cli reports 
							// 		creating images but does not...
							// 		...we seem to be reacing .makeResizedImage(..)
							// 		but them something odd happens -- nether of 
							// 		the .then(..) callbacks is called...
							// 		...even weirder, code before the call executes
							// 		while wrapping the call in a console.log(..)
							// 		produces nothing, not even a syntax error...
							index.makePreviews('all') ])} })
				.then(function(){
					return index
						.sortImages()
						.saveIndex() }) }],
	// XXX does not work yet...
	cliUpdateIndex: ['- System/CLI/update index',
		{cli: {
			name: '@update',
			arg: 'PATH',
		}},
		'cliInitIndex: "update" ...'],

	// XXX handle errors...
	cliInfo: ['- System/CLI/show information about index in PATH',
		{cli: {
			name: '@info', 
			arg: 'PATH',
		}},
		function(path, options={}){
			var that = this
			path = path ?? '.'
			this.setupFeatures()
			return this.loadIndex(path)
				.then(
					async function(){
						var modified = 
							Object.values(
								await that.loadSaveHistoryList())
							.map(function(log){
								return Object.keys(log) })
							.flat()
							.sort()
							.pop()
						// calculate core.doc compatible offset for nested items.
						var offset = '\t'.repeat(`
							`.split('\t').length)
						console.log(core.doc`
							Load path: ${ path }
							Index path: ${ that.location.path }
							Loaded indexes: ${ 
								['', ...that.location.loaded].join('\n'+offset) }
							Current image: ${ that.current }
							Image count: ${ that.data.order.length }
							Collections: ${ 
								that.collections ?
									['', ...Object.keys(that.collections || [])].join('\n'+offset)
									: '-' }
							Modified date: ${ modified }`) },
					function(err){
						console.error('Can\'t find or load index at:', path) }) }],
	cliListCollections: ['- System/CLI/list collections in index',
		{cli: argv && argv.Parser({
			key: '@collections',
			doc: 'list collection in index at PATH',
			arg: 'PATH',

			'-version': undefined,
			'-quiet': undefined,

			'-f': '-full',
			'-full': {
				doc: 'show full collection information',
				type: 'bool',
			},
		})},
		function(path, options={}){
			var that = this

			this.setupFeatures()

			path = path || options.value
			path = util.normalizePath(
				path ?
					pathlib.resolve(process.cwd(), path)
					: process.cwd())
			return this.loadIndex(path)
				.then(
					function(){
						for(var name of that.collection_order || []){
							// XXX revise output formatting...
							options.full ?
					   			console.log(that.collections[name].gid, name) 
								: console.log(name) } },
					function(err){
						// XXX how do we handle rejection???
						console.error('Can\'t find or load index at:', path) }) }],

	// XXX
	cliCloneIndex: ['- System/CLI/clone index',
		function(){
		}],
	// XXX report that can't find an index...
	// XXX move options to generic object for re-use...
	// XXX how do we handle errors???
	cliExportImages: ['- System/CLI/export images',
		{cli: argv && argv.Parser({
			key: '@export',
			doc: 'export images',
			// help...
			'-help-pattern': {
				doc: 'show image filename pattern info and exit',
				priority: 89,
				handler: function(){
					this.parent.context
						// XXX SETUP
						//.setupFeatures('fs', 'commandline')
						.setupFeatures()
						.help('formatImageName')
					return argv.STOP } },
			'-version': undefined,
			'-quiet': undefined,
			// commands...
			'@from': {
				doc: 'source path',
				arg: 'PATH | from',
				default: '.',
				valueRequired: true, },
			// XXX
			'@collection': {
				doc: 'source collection (name/gid)',
				arg: 'COLLECTION | collection',
				//default: 'ALL',
				valueRequired: false, },
			//*/
			'@to': {
				doc: 'destination path',
				arg: 'PATH | path',
				required: true,
				valueRequired: true, },
			// bool options...
			// XXX these should get defaults from .config
			'-include-virtual': {
				doc: 'include virtual blocks',
				arg: '| include-virtual',
				type: 'bool',
				//value: true, 
				default: true, },
			'-clean-target': {
				doc: 'cleanup target before export (backup)',
				arg: '| clean-target',
				type: 'bool',
				//value: true,
				default: true, },
			'-no-*': {
				doc: 'negate boolean option value',
				handler: function(rest, key, value, ...args){
					rest.unshift(key.replace(/^-?-no/, '') +'=false') } },
			// options...
			'-image-name': {
				doc: 'image name pattern',
				arg: 'PATTERN | preview-name-pattern',
				default: '%(fav)l%n%(-%c)c',
				valueRequired: true, },
			'-mode': { 
				// XXX get doc values from system...
				doc: 'export mode, can be "resize" or "copy best match"', 
				arg: 'MODE | export-mode',
				//default: 'copy best match',
				default: 'resize',
				valueRequired: true, },
			'-image-size': {
				doc: 'output image size',
				arg: 'SIZE | preview-size',
				default: 1000,
				valueRequired: true, },
		})},
		function(path, options={}){
			var that = this

			// XXX SETUP
			this.setupFeatures()

			path = path || options.from
			path = util.normalizePath(
				path ?
					pathlib.resolve(process.cwd(), path)
					: process.cwd())

			var collection = options.collection

			return this.loadIndex(path)
				.then(
					function(){
						// export collection...
						if(collection){
							if(!that.collections[collection]){
								console.error(
									'Can\'t find collection "'+collection+'" in index at:', path)
								// XXX how do we handle rejection???
								//return Promise.reject('moo') 
								return } 
							var resolve
							var reject
							// XXX add a timeout???
							that.one('collectionLoading.post', 
								function(){
									resolve(that.exportImages(options)) })
							that.loadCollection(collection)
							return new Promise(function(res, rej){
								resolve = res
								reject = rej }) }
						// export root...
						return that.exportImages(options) },
					function(err){
						// XXX how do we handle rejection???
						console.error('Can\'t find or load index at:', path) }) }],


	cliRepairIndex: ['- System/CLI/repair index',
		{cli: argv && argv.Parser({
			key: '@repair',
			doc: 'repair index',
			arg: 'PATH',

			'-version': undefined,
			'-quiet': undefined,

			'-read-only': '-ro',
			'-ro': {
				doc: 'only show possible fixes',
				type: 'bool',
			},

		})},
		async function(path, options){
			this.setupFeatures()

			await this.loadIndex(path ?? '.')

			var changes = await this.checkIndex()

			// XXX print...
			console.log(options.ro, changes)

			options.ro
				//|| this.saveIndexHere()
				|| console.log('save')
	   	}],


	// XXX this is still wrong...
	_cliMakeIndex: ['- System/',
		`chain: [
			"loadImages: $1",
			"saveIndex",
			"makePreviews: 'all'",
			"sortImages",
			"saveIndex", ]`],

	cliCleanIndex: ['- System/',
		{},
		function(path, options){}],

	/* XXX
	cliStartServer: ['- System/CLI/start as server',
		{cli: '-server'},
		function(){
			// XXX
		}],

	// Actions...
	//
	// XXX
	// XXX this should be a nested parser...
	// 		args:
	// 			from=PATH
	// 			to=PATH
	// 			...
	cliExportIindex: ['- System/CLI/clone index',
		{cli: {
			name: '@clone',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	cliPullChanges: ['- System/CLI/pull changes',
		{cli: {
			name: '@pull',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	cliPushChanges: ['- System/CLI/push changes',
		{cli: {
			name: '@push',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	//*/

})


// XXX revise architecture....
// XXX move this to the argv parser used in object.js
var CLI = 
module.CLI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'commandline',
	depends: [
		'lifecycle',
		'logger',
	],

	// XXX should this be ONLY node???
	isApplicable: function(){ 
		return this.runtime.node && !this.runtime.browser },

	actions: CLIActions,

	handlers: [
		// supress logging by default...
		['start.pre', 
			function(){
				this.logger 
					&& (this.logger.quiet = true) }],

		// handle args...
		// XXX
		['ready',
			function(){
				var that = this

				//var pkg = require('package.json')
				var pkg = nodeRequire('./package.json')
				var wait_for = []
				// XXX
				var interactive = false

				// XXX SETUP need to setup everything that has command-line features...
				//this.setupFeatures()

				// revise name...
				argv.Parser({
						context: this,

						// XXX argv.js is not picking these up because 
						// 		of the require(..) mixup...
						author: pkg.author,
						version: pkg.version,
						license: pkg.license,

						// examples...
						examples: CLIActions.cliExamples ?
							CLIActions.cliExamples.flat()
							: null,

						'-verbose': {
							doc: 'enable (very) verbose output',
							handler: function(){
								that.logger 
									&& (that.logger.quiet = false) } },
						// XXX merge this with -quiet...
						'-no-progress': {
							doc: 'disable progress bar display',
							handler: function(){
								that.__progress = false } },

						// XXX setup presets...
						//		...load sets of features and allow user 
						//		to block/add specific features...

						// XXX config editor...
						// 		...get/set persistent config values...

						// build the action command list...
						...this.cliActions
							.reduce(function(res, action){
								var cmd = that.getActionAttr(action, 'cli')
								if(typeof(cmd) == typeof('str') || cmd === true){
									var name = cmd
									var cmd = {name} }
								var name = name === true ? 
									action 
									: (cmd.key || cmd.name)

								// skip interactive commands in non-interactive 
								// contexts...
								if(!interactive && cmd.interactive){
									return res }

								res[name] = cmd instanceof argv.Parser ?
									// parser...
									cmd
										.then(function(unhandled, value, rest){
											wait_for.push(that[action](value, this)) })
									// single option definition...
									: {
										doc: (that.getActionAttr(action, 'doc') || '')
											.split(/[\\\/]/g).pop(),
										handler: function(rest, key, value){
											var res = that[action](value) 
											wait_for.push(res)
											return res },
										...cmd,
									}

								return res }, {}),
					})
					.onArgs(function(){
						that.argv = this })
					.onNoArgs(function(args){
						console.log('No args.')

						// XXX we should either start the GUI here or print help...
						args.push('-h')
						//args.push('gui')
					})
					.stop(function(){ process.exit() })
					.error(function(){ process.exit() })
					.then(function(){
						// XXX
					})()

				// XXX not all promises in the system resolve strictly 
				// 		after all the work is done, some resolve before that
				// 		point and this calling process.exit() will interrupt 
				// 		them...
				this.__keep_running
					|| this.afterAction(function(){ this.stop() }) }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
