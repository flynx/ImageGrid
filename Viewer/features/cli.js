/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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
}



/*********************************************************************/
// XXX what we need here is:
// 		- base introspection
// 			- list features
// 			- list actions
// 			- list action scripts / commands
// 		- call action
// 		- call action script (a-la git commands)
// 		- repl (debug/testing)
//
// XXX the main functionality:
// 		- make previews
// 		- make index
// 		- merge
// 		- clone
//
// XXX a different approach to this would be an "external" cli controller
// 		script that would contain only cli code and load the ImageGrid
// 		only in the handler...
// 			+ would be allot faster to load.
// 			+ more flexible as we can load more than one instance...
// 		This could still be done via features, just load the cli feature
// 		alone at first and then either create new instances or setup 
// 		additional features as needed...



var CLIActions = actions.Actions({

	get cliActions(){
		return this.actions
			.filter(function(action){
				return this.getActionAttr(action, 'cli') }.bind(this)) },

	// XXX should this be here???
	// 		...move this to progress...
	__progress: null,
	showProgress: ['- System/',
		function(text, value, max){
			var msg = text instanceof Array ? text.slice(1).join(': ') : null
			text = text instanceof Array ? text[0] : text

			var state = this.__progress = this.__progress || {}
			state = state[text] = state[text] || {}

			// normalize max and value...
			max = state.max = max != null ? 
					(typeof(max) == typeof('str') && /[+-][0-9]+/.test(max) ? 
						(state.max || 0) + parseInt(max)
					: max)
				: state.max
			value = state.value = value != null ? 
					(typeof(value) == typeof('str') && /[+-][0-9]+/.test(value) ? 
						(state.value || 0) + parseInt(value)
					: value)
				: state.value

			// format the message...
			msg = msg ? ': '+msg : ''
			msg = ' '+ msg 
				//+ (value && value >= (max || 0) ? ' ('+value+' done)' 
				+ (value && value >= (max || 0) ? ' (done)' 
					: value && max && value != max ? ' ('+ value +' of '+ max +')'
					: '...')

			msg != state.msg
				&& console.log(msg)

			state.msg = msg
		}],

	startREPL: ['- System/Start CLI interpreter',
		{cli: '@repl'},
		function(){
			var repl = nodeRequire('repl')

			this._keep_running = true

			// setup the global ns...
			global.ig =
			global.ImageGrid = 
				this

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
					//ig.stop() 
					process.exit() }) }],
	startGUI: ['- System/Start viewer GUI',
		{cli: '@gui'},
		function(){
			// XXX
		}],

	// XXX this is reletively generic, might be useful globally...
	makeIndex: ['- System/Make index',
		{cli: {
			name: '@make',
			arg: 'PATH',
			valueRequired: true,
		}},
		function(path){
			var that = this
			path = util.normalizePath(path)

			// XXX is cloning index here the correct way to go???
			//var index = this.clone()
			var index = this
			return index.loadImages(path)
				// save base index...
				.then(function(){ 
					return index.saveIndex() })
				// sharp stuff...
				.then(function(){
					if(index.makePreviews){
						return Promise.all([
							index.cacheMetadata('all'),
							index.makePreviews('all') ])} })
				.then(function(){
					return index
						.sortImages()
						.saveIndex() }) }],
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
		['ready',
			function(){
				var that = this

				var pkg = nodeRequire('./package.json')

				argv.Parser({
						// XXX argv.js is not picking these up because 
						// 		of the require(..) mixup...
						author: pkg.author,
						version: pkg.version,
						license: pkg.license,

						// XXX setup presets...
						//		...load sets of features and allow user 
						//		to block/add specific features...

						// XXX feature config...
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
									: cmd.name 

								res[name] = {
									doc: (that.getActionAttr(action, 'doc') || '')
										.split(/[\\\/]/g).pop(),
									// XXX revise argument passing...
									// 		...this must be as flexible as possible...
									handler: function(rest, key, value){
										return that[action](value) },
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
					.then(function(){
						// XXX
					})()

				// XXX is this the right way to trigger state change 
				// 		from within a state action...
				!this._keep_running
					&& this.afterAction(function(){ process.exit() })
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
