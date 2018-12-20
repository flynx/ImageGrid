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
}


/*********************************************************************/

// setup logger...
// XXX STUB...
var logger = {
	root: true,
	message: null,
	log: null,
	ig: null,

	emit: function(e, v){ 
		var msg = this.message
		var log = this.log = this.log || []

		// XXX HACK...
		var ig = this.ig

		// report progress...
		// XXX HACK -- need meaningful status...
		if(e == 'queued' 
				|| e == 'found'){
			ig.showProgress(msg || ['Progress', e], '+0', '+1')

		} else if(e == 'loaded' || e == 'done' || e == 'written' 
				|| e == 'index'){
			ig.showProgress(msg || ['Progress', e], '+1')

		} else if(e == 'skipping' || e == 'skipped'){
			// XXX if everything is skipped the indicator does not 
			// 		get hidden...
			//ig.showProgress(msg || ['Progress', e], '+0', '-1')
			ig.showProgress(msg || ['Progress', e], '+1')

		// XXX STUB...
		} else if(e == 'error' ){
			ig.showProgress(['Error'].concat(msg), '+0', '+1')
			console.log(msg ? 
				'    '+ msg.join(': ') + ':' 
				: '', ...arguments) 

		} else {
			// console...
			console.log(msg ? 
				'    '+ msg.join(': ') + ':' 
				: '', ...arguments) 
		}

		// XXX
		//log.push([msg, e, v])
	},

	push: function(msg){
		if(msg == null){
			return this
		}

		var logger = Object.create(this)
		logger.root = false
		logger.message = logger.message == null ? [msg] : logger.message.concat([msg])
		logger.log = this.log = this.log || []

		return logger
	},
	pop: function(){
		return !this.__proto__.root ? this.__proto__ : this	
	},
}



/*********************************************************************/
// XXX what we need here is:
// 		- base introspection
// 			- list features
// 			- list actions
// 			- list action scripts / commands
// 		- call action
// 		- call action script (a-la git commands)
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


	makeIndex: ['- System/',
		function(path){
			var that = this

			// XXX is this correct???
			path = path || this.location.path

			path = util.normalizePath(path)

			return this.loadImages(path)
				// save base index...
				.then(function(){ 
					return that.saveIndex(path)
				})
				// make the previews...
				.then(function(){
					if(that.makePreviews){
						return that.makePreviews('all')
					}
				})
				.then(function(){
					//that.readAllMetadata()

					return that
						.sortImages()
						// XXX for some reason this is not running from cli
						.saveIndex(path)
				})
		}],
})


var CLI = 
module.CLI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'commandline',
	depends: [
		'lifecycle'
	],

	// XXX should this be ONLY node???
	isApplicable: function(){ 
		return this.runtime.node && !this.runtime.browser },

	actions: CLIActions,

	handlers: [
		['ready',
			function(){
				var that = this

				this.logger = logger
				logger.ig = that

				// get the arguments...
				if(this.runtime.nw){
					var argv = nw.App.argv

					// XXX appears to have a stray '--help' lodged in 
					// 		all the time...
					// 		...need to test this with a packed exec...
					console.log('>>>>', argv)

				} else if(this.runtime.node){
					var argv = process.argv
				}


				var keep_running = false

				// XXX this is not portable...
				//var package = requirejs('fs-extra').readJSONSync('./package.json')

				var cli = requirejs('commander')
				cli
					// XXX get the version from package.json...
					.version(that.version)

					//.usage('[command] [options] ..')

					.option('-v, --verbose', 'verbose mode', function(){
						// XXX use a standard logger...
						that.logger = { 
							root: true,
							push: function(){ 
								var o = Object.create(this) 
								o.root = false
								o.__prefix = (this.__prefix || []).concat([...arguments])
								return o
							},
							pop: function(){
								return this.root ? this : this.__proto__
							},
							emit: function(){ 
								console.log.apply(console, 
									(this.__prefix || []).concat([...arguments]))
							}, 
						}
					})

					// list features...
					// XXX make this a core action... (???)
					.option('lf, --list-features', 'list loaded features', function(){
						// excluded...
						that.features.excluded.length > 0 
							&& console.warn('Features excluded (%d):\n   ',
								that.features.excluded.length, 
								that.features.excluded.join('\n    '))

						// not applicable...
						that.features.unapplicable.length > 0 
							&& console.log('Features not applicable (%d):\n   ', 
								that.features.unapplicable.length, 
								that.features.unapplicable.join('\n    '))

						// loaded...
						console.log('Features loaded (%d):\n   ',
							that.features.features.length, 
							that.features.features.join('\n    '))
					})
					// XXX make this applicable features...
					.option('laf, --list-available-features', 'list available features', function(){
						// XXX bug, this hangs....
						//console.log(core.ImageGridFeatures.buildFeatureList())

						var f = core.ImageGridFeatures.features
						console.log('Features available (%d):\n   ',
							f.length, 
							f.join('\n    '))
					})

					// list actions...
					// XXX this is a bit pointless as single actions are
					// 		meaningless when no state is stored...
					.option('la, --list-actions', 'list loaded actions', function(){
						console.log('Actions loaded (%d):\n   ', 
							that.length, 
							Object.keys(that.getDoc()).join('\n    '))
					})

					// XXX experimental....
					// 		to see this in action use:
					// 			ig lf sm lf
					// 		...this will print the list of features before
					// 		and after setup...
					.option('sm, --setup-minimal', 'setup minimal features', function(){
						// load features we might need...
						var all = require('features/all')

						// extend the current instance to a minimal non-ui
						// state...
						core.ImageGridFeatures
							.setup(that, ['imagegrid-minimal'])
					})

					.option('repl, --repl', 'start an ImageGrid REPL', function(){
						var repl = nodeRequire('repl')

						keep_running = true

						// setup the global ns...
						global.ig =
						global.ImageGrid = 
							that

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
								ig.stop()
							})
					})

					// XXX this needs both a local/linked nwjs installed and an 
					// 		appropriate nw version under it...
					// 			npm install -g nwjs
					// 			npm link nwjs
					// 			nw install 0.14.5-sdk
					.option('gui, --gui', 'start ImageGrid.Viewer', function(){
						throw new Error('ig: GUI startup not implemented.')

						var path = requirejs('path')

						requirejs('child_process')
							.spawn(requirejs('nwjs'), [
								path.dirname(process.argv[1]).replace(/\\/g, '/') + '/'])

						keep_running = true
					})

					/* // XXX the problem with this is that it still tires 
					// 		to find and run 'ig-index'...
					.command('index [path]', 'build an index of path')
					.action(function(path){
						console.log('!!!!!! INDEX', path)

						//this.makeIndex(path)
					})
					//*/

					// XXX might be a good idea to make the action call
					// 		syntax like this:
					// 			--<action-name> [args]
					.arguments('<action> [args]')
					.action(function(action, args){
						// XXX
						//console.log('>>>>', action, args, !!that[action])
						if(!that[action]){
							console.error('No such action:', action)
							return
						}

						var res = that[action](args)

						if(res instanceof Promise){
							keep_running = true
							res.then(function(){
								process.exit()
							})
						}
					})

					.parse(argv)


				// XXX is this the right way to trigger state change 
				// 		from within a state action...
				!keep_running
					&& this.afterAction(function(){ process.exit() })
			}],
		/*
		['stop',
			function(){
				console.log('STOP') }],
		//*/
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
