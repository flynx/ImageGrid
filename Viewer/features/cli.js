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


if(typeof(process) != 'undefined'){
	var pathlib = requirejs('path')
	var argv = requirejs('lib/argv')
	var progress = requirejs('cli-progress')
	var colors = requirejs('colors')
}



/*********************************************************************/

var CLIActions = actions.Actions({
	config: {
		// XXX do we care that something is not "ready" here???
		'declare-ready-timeout': 0,
	},

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

			var settings = this.__progress = this.__progress || {}
			var state = settings[text] = settings[text] || {}

			var l = Math.max(text.length, settings.__text_length || 0)
			// length changed -> update the bars...
			l != settings.__text_length
				&& Object.entries(settings)
					.forEach(function([key, value]){
						value instanceof Object 
							&& 'bar' in value
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
				state.bar || container.create(0, 0, {text: text.padEnd(l)})

			bar.setTotal(Math.max(max, value))
			bar.update(value)
		}],

	// handle logger progress...
	// XXX this is a copy from ui-progress -- need to reuse...
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
				//this.showProgress(path, 'close')
			// reset...
			} else if(status == 'reset' || reset.has(status)){
				//this.showProgress(path, 'reset')
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



	// Startup commands...
	//
	startREPL: ['- System/Start CLI interpreter',
		{cli: '@repl'},
		function(){
			var that = this
			var repl = nodeRequire('repl')

			this.__keep_running = true

			// setup the global ns...
			global.ig =
			global.ImageGrid = 
				this

			global.help = function(...actions){
				global.ig.help(...actions) }

			require('features/all')
			global.ImageGridFeatures = core.ImageGridFeatures

			//var ig = core.ImageGridFeatures
			
			repl
				.start({
					prompt: 'ig> ',

					useGlobal: true,

					input: process.stdin,
					output: process.stdout,

					//ignoreUndefined: true,
				})
				.on('exit', function(){
					that.stop() }) }],
	// XXX this is the wrong strategy...
	// XXX move this to a feature that requires electron...
	// 		...and move electron to an optional dependency...
	startGUI: ['- System/Start viewer GUI',
		{cli: '@gui'},
		function(){
			requirejs('child_process')
				.spawn(requirejs('electron'), [
						pathlib.join(
							pathlib.dirname(nodeRequire.main.filename), 
							'e.js') ])
				// XXX need to stop the process iff nothing 
				// 		else is running, like repl... 
				// XXX feels hackish...
				.on('exit', function(){
					(!global.ig
							|| global.ig.isStopped())
						&& process.exit() })
			this.__keep_running = true }],
	// XXX
	startWorker: ['- System/Start as worker',
		{cli: '-worker'},
		function(){
			// XXX
		}],

	// Actions...
	//
	/*/ XXX
	// XXX this should be a nested parser...
	// 		args:
	// 			from=PATH
	// 			to=PATH
	// 			...
	cliExportIindex: ['- System/Clone index',
		{cli: {
			name: '@clone',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	cliPullChanges: ['- System/Pull changes',
		{cli: {
			name: '@pull',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	cliPushChanges: ['- System/Push changes',
		{cli: {
			name: '@push',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(){
			// XXX
		}],
	//*/

	// XXX report that can't find an index...
	// XXX move options to generic object for re-use...
	cliExportImages: ['- System/Export images',
		{cli: argv && argv.Parser({
			key: '@export',

			// help...
			'-help-pattern': {
				doc: 'Show image filename pattern info and exit',
				priority: 89,
				handler: function(){
					this.parent.context.help('formatImageName')
					return argv.STOP } },
			'-version': undefined,
			'-quiet': undefined,

			// commands...
			'@from': {
				doc: 'Source path',
				arg: 'PATH | from',
				default: '.',
				valueRequired: true, },
			'@to': {
				doc: 'Destination path',
				arg: 'PATH | path',
				required: true,
				valueRequired: true, },

			// bool options...
			// XXX these should get defaults from .config
			'-include-virtual': {
				doc: 'Include virtual blocks',
				arg: '| include-virtual',
				type: 'bool',
				value: true, 
				default: true, },
			'-clean-target': {
				doc: 'Cleanup target before export (backup)',
				arg: '| clean-target',
				type: 'bool',
				value: true,
				default: true, },
			'-no-*': {
				doc: 'Negate boolean option value',
				handler: function(rest, key, value, ...args){
					rest.unshift(key.replace(/^-?-no/, '') +'=false') } },

			// options...
			'-image-name': {
				doc: 'Image name pattern',
				arg: 'PATTERN | preview-name-pattern',
				default: '%(fav)l%n%(-%c)c',
				valueRequired: true, },
			// XXX get values automatically...
			'-mode': { 
				doc: 'Export mode, can be "resize" or "copy best match"', 
				arg: 'MODE | export-mode',
				//default: 'copy best match',
				default: 'resize',
				valueRequired: true, },
			'-image-size': {
				doc: 'Output image size',
				arg: 'SIZE | preview-size',
				default: 1000,
				valueRequired: true, },
		})},
		function(path, options={}){
			var that = this

			path = path || options.from
			path = util.normalizePath(
				path ?
					pathlib.resolve(process.cwd(), path)
					: process.cwd())

			return this.loadIndex(path)
				.then(
					function(){
						return that.exportImages(options) },
					function(err){
						console.error('Can\'t find or load index at:', path) }) }],

	// Utility... (EXPERIMENTAL)
	//
	// XXX metadata caching and preview creation are not in sync, can 
	// 		this be a problem???
	// 		...if not, add a note...
	// XXX should we support creating multiple indexes at the same time???
	// XXX this is reletively generic, might be useful globally...
	// XXX should we use a clean index or do this in-place???
	// XXX add ability to disable sort...
	initIndex: ['- System/Make index',
		core.doc`

			Create index in current directory
			.initIndex()
			.initIndex('create')
				-> promise

			Create index in path...
			,initIndex(path)
			.initIndex('create', path)
				-> promise


			Update index in current directory
			.initIndex('update')
				-> promise

			Update index in path...
			.initIndex('update', path)
				-> promise

		`,
		{cli: {
			name: '@init',
			arg: 'PATH',
			//valueRequired: true,
		}},
		function(path, options){
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
							index.makePreviews('all') ])} })
				.then(function(){
					return index
						.sortImages()
						.saveIndex() }) }],
	// XXX does not work yet...
	updateIndex: ['- System/Update index',
		{cli: {
			name: '@update',
			arg: 'PATH',
		}},
		'initIndex: "update" ...'],
	cleanIndex: ['- System/',
		{},
		function(path, options){}],
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

				var pkg = nodeRequire('./package.json')
				var wait_for = []

				argv.Parser({
						context: this,

						// XXX argv.js is not picking these up because 
						// 		of the require(..) mixup...
						author: pkg.author,
						version: pkg.version,
						license: pkg.license,

						'-verbose': {
							doc: 'Enable verbose (very) output',
							handler: function(){
								that.logger 
									&& (that.logger.quiet = false) } },
						// XXX merge this with -quiet...
						'-no-progress': {
							doc: 'Disable progress bar display',
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
					.onNoArgs(function(args){
						console.log('No args.')

						// XXX we should either start the GUI here or print help...
						args.push('--help')
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
