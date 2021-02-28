/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var runner = require('lib/types/runner')

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')
var widgets = require('features/ui-widgets')

var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

var browseWalk = require('lib/widget/browse-walk')


/*********************************************************************/

var ExampleActions = actions.Actions({
	config: {
		// XXX stuff for togglers...
	},

	// NOTE: the path / short doc is optional but it is not recommended 
	// 		to to omit it unless defining a non-root action...
	// XXX should an action be able to overload the doc???
	// 		...the intuitive thing to do here is make the doc "write-once"
	// 		i.e. once defined it can't be overwritten...
	exampleAction: ['Test/Action',
		function(){
			console.log('>>>', ...arguments)
			return function(){
				console.log('<<<', ...arguments) }}],
	exampleActionFull: ['- Test/',
		core.doc`Example full action long documentation string
		`,
		// action attributes...
		{},
		function(){
			// XXX
		}],

	exampleActionDebounced: ['Test/Action (debounced)',
		core.doc`This is .exampleAction(..) debounced.
		`,
		core.debounce('exampleAction')],
	exampleDebouncedAction: ['Test/Custom debounced action',
		core.debounce(1000, function(...args){
			console.log('exampleDebouncedAction: This can\'t be called more often than once per 1 second.')
			console.log('exampleDebouncedAction: note that within this second only the original return value is returned.')
			console.log('    <', args)
			return args })],
	exampleAliasDebounced: ['Test/',
		core.debounce(1000, 'exampleAction: ...')],

	exampleAfterActionCall: ['Test/',
		function(){
			// schedule a call after the action is done...
			this.afterAction('local',
				function(){ console.log('exampleAfterActionCall: done.') })
			// schedule a call after the top action call...
			this.afterAction('top', 
				function(){ console.log('exampleAfterActionCall: final done.') }) }],
	exampleNestedAfterActionCall: ['Test/',
		function(){
			this.afterAction(function(){ console.log('exampleNestedAfterActionCall: done.') })
			this.exampleAfterActionCall() }],

	// a normal method...
	exampleMethod: function(){
		console.log('example method:', [...arguments])
		return 'example result' },

	// XXX does not work -- see actions.Actions(..) for details...
	exampleAlias: ['Test/Action alias',
		'focusImage: "prev"'],

	// action constructor for testing...
	makeExampleAction: ['- Test/',
		function(name){
			this[name] = actions.Action.apply(actions.Action, arguments) }],

	// promise handling...
	//
	// also see corresponding Example.handlers
	exampleSyncAction: ['- Test/',
		//{await: true},
		function(t){
			return new Promise(function(resolve){
				setTimeout(function(){ resolve() }, t || 1000) }) }],
	exampleAsyncAction: ['- Test/',
		{await: false},
		function(t){ 
			return new Promise(function(resolve){
				setTimeout(function(){ resolve() }, t || 1000) }) }],

	// Togglers...
	//
	// There are two state change strategies generally used:
	// 	1) state accessor changes state (this example)
	// 	2) callbacks change state
	//
	// XXX add example argument handling...
	exampleToggler: ['Test/Example toggler',
		core.doc`Example toggler...

		A toggler is any function that adheres to the toggler protocol 
		and (optionally) inherits from toggler.Toggler

		toggler.Toggler(..) is also a convenient toggler constructor, 
		see: .exampleToggler(..) and .exampleTogglerFull(..) as examples
		of its use.
		

		General toggler protocol:
		
			Change to the next state...
			.exampleToggler()
			.exampleToggler('next')
				-> state

			Change to the previous state...
			.exampleToggler('prev')
				-> state

			Change to specific state...
			.exampleToggler(state)
				-> state

			For bool togglers, set state on/off...
			.exampleToggler('on')
			.exampleToggler('off')
				-> state

			Get current state...
			.exampleToggler('?')
				-> state

			Get possible states...
			.exampleToggler('??')
				-> state


		It is also possible to pass an argument to a toggler, the recommended
		semantics for this is to change state of the entity passed as argument
		a good example would be .toggleMark(..)

			Handle state of arg (recommended semantics)...
			.exampleToggler(arg, ...)
				-> state


		Utilities:
			Check if an action is a toggler...
			.isToggler('exampleToggler')
				-> bool

		
		NOTE: it is not required to use toggler.Toggler(..) as constructor
			to build a toggler, a simple function that adheres to the above
			protocol is enough, though it is recommended to inherit from
			toggler.Toggler so as to enable support functionality that 
			utilizes the protocol...
		NOTE: see lib/toggler.js and toggler.Toggler(..) for more details.
		`,
		toggler.Toggler(null, 
			// state accessor...
			// NOTE: this may get called multiple times per state change.
			function(_, state){ 
				// get the state...
				// NOTE: this section should have no side-effects nor 
				// 		should it affect the state in any way...
				if(state == null){
					return this.__example_toggler_state || 'none'

				// handle state changing...
				} else if(state == 'none'){
					delete this.__example_toggler_state

				} else {
					this.__example_toggler_state = state } },
			// List of states...
			// NOTE: this can be a string for bool states and a list for
			// 		togglers with multiple states...
			'A')],
	exampleTogglerFull: ['Test/Example toggler (full)',
		core.doc``,
		toggler.Toggler(
			// target...
			// XXX more docs!
			null, 
			// state getter...
			function(_, state){ 
				// get the state...
				if(state == null){
					return this.__example_full_toggler_state || 'A'

				} else if(state == 'A'){
					delete this.__example_full_toggler_state

				} else {
					this.__example_full_toggler_state = state } },
			// List of states...
			['A', 'B', 'C'],
			// pre-callback (optional)
			function(){
				console.log('Changing state from:', this.exampleTogglerFull('?')) },
			// post-callback...
			function(){
				console.log('Changing state to:', this.exampleTogglerFull('?')) })],

	// XXX docs...
	// XXX BUG? false is not shown in the dialog button...
	exampleConfigTogglerMin: ['- Test/',
		core.doc`Minimal config toggler...

			This will toggle between true and false.
			`,
		core.makeConfigToggler('example-option-min')],
	// XXX docs...
	exampleConfigToggler: ['- Test/',
		core.makeConfigToggler(
			// option name...
			'example-option',
			// option states...
			//
			// NOTE: 'none' represents an undefined value, but when 
			// 		setting 'none' state, 'none' is explicitly written as
			// 		option value.
			// 		This is done intentionally as deleting the attribute
			// 		can expose the shadowed option value.
			['A', 'B', 'C', 'none'],
			// post-callback (optional)...
			function(state){
				console.log('exampleConfigToggler: callback: shifting state to:', state) })],
	// XXX docs...
	exampleConfigTogglerFull: ['- Test/',
		core.makeConfigToggler(
			// option name...
			'example-option-full',
			// option states...
			function(){
				return ['A', 'B', 'C', 'none'] },
			// pre-callback...
			function(state){
				if(state == 'C'){
					console.log('exampleConfigToggler: pre-callback: preventing shift to:', state)
					// we can prevent a state change by returning false...
					// XXX should we be able to return a different state here???
					return false }

				console.log('exampleConfigToggler: pre-callback: shifting state to:', state) },
			// post-callback...
			function(state){
				console.log('exampleConfigToggler: post-callback: shifting state to:', state) })],

	// XXX event and event use...
	
	// XXX inner/outer action...


	// Tasks...
	
	//
	// NOTE: action name and task name should be the same to avoid 
	// 		confusion...
	// 		XXX it would be quite complicated to support both and 
	// 			confusing to support either...
	exampleTask: ['- Test/',
		core.taskAction('Example task', 
			function(ticket, ...args){
				console.log('###', ticket.title+':', 'START:', ...args, 
					'\n\t\t(supported messages: "stop", "break", "error", ...)')
				ticket.onmessage(function(msg){
					// stop...
					if(msg == 'stop'){
						console.log('###', ticket.title+':', 'STOP', ...args)
						ticket.resolve(...args) 
					// break...
					} else if(msg == 'break'){
						console.log('###', ticket.title+':', 'BREAK', ...args)
						ticket.reject(...args) 
					// error...
					} else if(msg == 'error'){
						console.log('###', ticket.title+':', 'ERROR', ...args)
						throw new Error('Task error')
					// other...
					} else {
						console.log('###', ticket.title+':', 'Got message:', msg, ...args) } }) })],
	exampleSessionTask: ['- Test/',
		core.sessionTaskAction('Example session task', 
			function(ticket, ...args){
				console.log('###', ticket.title+':', 'START:', ...args)
				ticket.onmessage('stop', function(){
					console.log('###', ticket.title+':', 'STOP:', ...args) 
					ticket.resolve(...args) }) })],

	// Queued tasks...
	//
	// queued actions...
	exampleQueuedAction: ['- Test/',
		core.queuedAction('Example queued action', {quiet: true}, function(timeout=500, ...args){
			console.log('Queued action!!', ...args)
			return new Promise(function(resolve){
				setTimeout(resolve, timeout) }) })],
	exampleMultipleQueuedAction: ['- Test/',
		function(count=100, timeout=100){
			for(var i=0; i<count; i++){
				this.exampleQueuedAction(timeout) } }],
	// handler actions...
	exampleQueueHandlerAction: ['- Test/',
		core.queueHandler('Example queue handler action', 
			{quiet: true}, 
			function(item, ...args){
				console.log('Queue handler action!!', item, ...args)
				return new Promise(function(resolve){
					setTimeout(function(){ resolve(item) }, 100) }) })],
	exampleQueueHandlerActionWArgs: ['- Test/',
		core.queueHandler('Example queue handler with arguments', 
			{quiet: true}, 
			function(queue, from=0, to=100, ...args){
				var items = []
				var reverse = from > to
				reverse
					&& ([from, to] = [to+1, from+1])
				for(var i=from; i<to; i++){
					items.push(i) }
				reverse
					&& items.reverse()
				return [items, ...args] },
			function(item, timeout, ...args){
				console.log('Queue handler action!!', item, timeout, ...args)
				return new Promise(function(resolve){
					setTimeout(function(){ resolve(item) }, timeout || 100) }) })],

	exampleChainedQueueHandler: ['- Test/',
		core.queueHandler('Main queue',
			core.queueHandler('Sub queue',
				// pre-prepare the inputs (sync)...
				function(queue, next, items, ...args){
					// NOTE: here we will get both the "Sub queue" queue (queue) 
					// 		and the "Main queue" queue (next), but when called 
					// 		'sync' no queues are created and only 'sync' is 
					// 		passed as first argument...
					if(queue == 'sync'){
						var [queue, items, ...args] = arguments }

					console.log('\tPRE-PREP', items, ...args)

					return [items, queue, ...args] },
				// prepare inputs (async/queue)...
				function(item, q, ...args){
					console.log('\tPREP', item, ...args)

					// abort/stop queue...
					item == 'abort'
						&& q.abort()
						&& console.log('\t\tABORT', q)
					item == 'stop'
						&& q.stop()
						&& console.log('\t\tSTOP')

					// skip strings...
					if(typeof(item) == typeof('str')){
						console.log('\t\tSKIP', item)
						return runner.SKIP }

					// NOTE: the handler's return value list is .flat()-end
					// 		so if one needs to return a array the it must be
					// 		wrapped in an array...
					return item+1 }),
			// handle inputs (async/queue)... 
			function(item, ...args){
				console.log('\tHANDLE', item, ...args)
				return item*2 }) ],

})

var Example = 
module.Example = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'action-examples',
	depends: [
	],

	actions: ExampleActions, 

	// XXX make this not applicable in production...

	handlers: [
		[[
			'exampleAsyncAction.pre',
			'exampleSyncAction.pre',
			'exampleAfterActionCall.pre',
		], 
			function(){
				console.log('PRE')
				return function(){
					console.log('POST') } }],
		['exampleActionFull',
			'exampleAction: "alias handler!" ... -- some doc...'],
	],
})



//---------------------------------------------------------------------

var ExampleUIActions = actions.Actions({
	// XXX move this to a ui-dependant feature...
	exampleCSSClassToggler: ['- Test/',
		function(){
		}],

	exampleActionDisabled: ['Test/$Disabled example action',
		{mode: function(){ return 'disabled' }},
		function(){ 
			console.log('Disabled action called:', [...arguments]) }],

	// Usage Examples:
	// 	.exampleDrawer()						- show html in base drawer...
	// 	.exampleDrawer('Header', 'paragraph')	- show html with custom text...
	// 	.exampleDrawer('Overlay')				- show html in overlay...
	// 	.exampleDrawer('Overlay', 'Header', 'paragraph')
	// 										- show html in overlay with 
	// 										  custom text...
	exampleDrawer: ['Test/99: D$rawer widget example...',
		widgets.makeUIDialog('Drawer', 
			function(h, txt){
				return $('<div>')
					.css({
						position: 'relative',
						background: 'white',
						height: '300px',
						padding: '20px',
					})
					.append($('<h1>')
						.text(h || 'Drawer example...'))
					.append($('<p>')
						.text(txt || 'With some text.')) },
			// pass custom configuration to container...
			{
				background: 'white',
				focusable: true,
			})],
	// XXX show new features...
	exampleBrowse: ['Test/-99: Demo $new style dialog...',
		widgets.makeUIDialog(function(){
			var actions = this

			console.log('>>> args:', [...arguments])

			return browse.makeLister(null, function(path, make){
				var that = this

				make('select last') 
					.on('open', function(){
						that.select(-1) })
					
				make('do nothing')
					.addClass('marked')

				make('nested dialog...',
					{
						shortcut_key: 'n',
					})
					.on('open', function(){
						actions.exampleBrowse() })

				make('---')


				make('$close parent')
					.on('open', function(){
						that.parent.close() })

				make('...')

				// NOTE: the dialog's .parent is not yet set at this point...

				// This will finalize the dialog...
				//
				// NOTE: this is not needed here as the dialog is drawn
				// 		on sync, but for async dialogs this will align
				// 		the selected field correctly.
				make.done() })
			// NOTE: this is not a dialog event, it is defined by the 
			// 		container to notify us that we are closing...
			.on('close', function(){
				console.log('Dialog closing...') }) })],
	// XXX use tag list and current image tags....
	exampleBrowseCloud: ['Test/Demo $cloud dialog...',
		widgets.makeUIDialog(function(){
			var actions = this

			console.log('>>> args:', [...arguments])

			return browse.makeLister(null, function(path, make){
				var that = this

				var words = 'Lorem ipsum dolor sit amet, audiam sensibus '
					+'an mea. Accusam blandit ius in, te magna dolorum '
					+'moderatius pro, sit id dicant imperdiet definiebas. '
					+'Ad duo quod mediocrem, movet laudem discere te mel, '
					+'sea ipsum habemus gloriatur at. Sonet prodesset '
					+'democritum in vis, brute vitae recusabo pri ad, '
					+'--- '
					+'latine civibus efficiantur at his. At duo lorem '
					+'legimus, errem constituam contentiones sed ne, '
					+'cu has corpora definitionem.'

				var res = []
				words
					.split(/\s+/g)
					.unique()
					.forEach(function(c){ 
						var e = make(c) 
							// toggle opacity...
							.on('open', function(){
								var e = $(this).find('.text')
								e.css('opacity', 
									e.css('opacity') == 0.3 ? '' : 0.3)
							})
						res.push(e[0]) })

				$(res).parent()
					.append($('<div>')
						.sortable()
						.append($(res)))

				make.done() }, 
			// make the dialog a cloud...
			{ cloudView: true })
			// NOTE: this is not a dialog event, it is defined by the 
			// 		container to notify us that we are closing...
			.on('close', function(){
				console.log('Dialog closing...') }) })],
	exampleBrowsrItems: ['Test/-99: Demo browse $items...',
		widgets.makeUIDialog(function(){
			var actions = this

			var editable_list = ['x', 'y', 'z']

			return browse.makeLister(null, function(path, make){
				var that = this

				make.Heading('Heading:', {
					doc: 'Heading doc string...',
				})

				make.Group([
					make('Normal item'),

					// this is the same as make('...')
					make.Separator(),

					make.Editable('Editable (Select to edit)'),

					make.Editable('Editable (Enter to edit, cleared)...', {
						start_on: 'open',
						clear_on_edit: true,
					}),
				])

				make.Heading('List:')
				make.List(['a', 'b', 'c'])

				make.Heading(' Editable list:')
				make.EditableList(editable_list)

				make.Heading('More:')
				make.Action('Editable list demos...')
					.on('open', function(){ actions.exampleList() })
				make.Action('Pinned list demo...')
					.on('open', function(){ actions.examplePinnedList() })

				// NOTE: the dialog's .parent is not yet set at this point...

				// This will finalize the dialog...
				//
				// NOTE: this is not needed here as the dialog is drawn
				// 		on sync, but for async dialogs this will align
				// 		the selected field correctly.
				make.done() })
			// NOTE: this is not a dialog event, it is defined by the 
			// 		container to notify us that we are closing...
			.on('close', function(){
			}) })],
	exampleList: ['Test/-99: Demo $lists editors in dialog...',
		widgets.makeUIDialog(function(){
			var actions = this

			// NOTE: passing things other than strings into a list editor
			// 		is not supported...
			var numbers = ['1', '2', '3', '4']
			var letters = ['a', 'b', 'c', 'd']

			return browse.makeLister(null, function(path, make){
				var that = this

				make.Heading('Numbers:', {
					doc: 'List editor with all the buttons enabled...',
				})
				make.EditableList(numbers, { 
					list_id: 'numbers',
					item_order_buttons: true,
					to_top_button: true,
					to_bottom_button: true,
				})

				make.Heading('Letters:', {
					doc: 'Sortable list, use sort handle to the right to sort...'
				})
				make.EditableList(letters, { 
					list_id: 'letters', 
					sortable: 'y',
				})

				// NOTE: the dialog's .parent is not yet set at this point...

				// This will finalize the dialog...
				//
				// NOTE: this is not needed here as the dialog is drawn
				// 		on sync, but for async dialogs this will align
				// 		the selected field correctly.
				make.done() })
			// NOTE: this is not a dialog event, it is defined by the 
			// 		container to notify us that we are closing...
			.on('close', function(){
				console.log(core.doc`Lists:
				- Numbers: ${numbers.join(', ')}
				- Letters: ${letters.join(', ')}`) }) })],
	examplePinnedList: ['Test/-99: Demo $pinned lists in dialog...',
		widgets.makeUIDialog(function(){
			var actions = this

			// NOTE: passing things other than strings into a list editor
			// 		is not supported...
			var pins = ['b', 'a']
			var letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

			return browse.makeLister(null, function(path, make){
				var that = this

				make.Heading('Numbers:', {
					doc: 'List editor with all the buttons enabled...',
				})
				make.EditablePinnedList(letters, pins, { 
					list_id: 'letters',
					//pins_sortable: false,
				})

				// NOTE: the dialog's .parent is not yet set at this point...

				// This will finalize the dialog...
				//
				// NOTE: this is not needed here as the dialog is drawn
				// 		on sync, but for async dialogs this will align
				// 		the selected field correctly.
				make.done() })
			// NOTE: this is not a dialog event, it is defined by the 
			// 		container to notify us that we are closing...
			.on('close', function(){
				console.log(core.doc`Lists:
				- Pins: ${pins.join(', ')}
				- Letters: ${letters.join(', ')}`) }) })],

	exampleProgress: ['Test/Demo $progress bar...',
		function(text){
			var that = this

			var done = 0
			var max = 10
			var text = text || 'Progress bar demo'

			this.showProgress(text)

			var step = function(){
				that.showProgress(text, done++, max)

				max = done < 8 ? max + 5 
					: max <= 50 && done < 30 ? max + 2 
					: done > 30 ? max - 3
					: max

				// NOTE: we add 10 here to compensate for changing max value...
				done < max+10
					&& setTimeout(step, 200) }

			setTimeout(step, 1000) }], 

	exampleLoggerProgress: ['Test/Demo logger-based brogress bar...',
		function(text, logger){
			var that = this

			var done = 0
			var max = 10
			logger = logger 
				|| this.logger.push(text || 'Logger progress demo')

			logger.emit('add', 'a')
			logger.emit('add', 'b')
			logger.emit('add', 'c')
			logger.emit('add', new Array(7).fill('x'))

			var step = function(){
				done++

				logger.emit('done', 'a')

				done < 8
					&& (max += 5)
					&& logger.emit('add', [1, 2, 3, 4, 5])
				done < 30
					&& (max -= 1)
					&& logger.emit('skip', 'y')

				// NOTE: we add 10 here to compensate for changing max value...
				done < max
					&& setTimeout(step, 200) }

			setTimeout(step, 1000) }],

	// XXX make this a toggler....
	partitionByMonth: ['Test/',
		function(){
			var that = this

			this.toggleImageSort('?') != 'Date' && this.sortImages('Date')

			this.on('updateImage', function(_, gid){ this.placeMonthPartition(gid) }) }],
	// XXX this should be .updateImage(..) in a real feature...
	placeMonthPartition: ['Test/',
		function(image){
			var month = [
				'January', 'February', 'March', 'April',
				'May', 'June', 'July', 'August',
				'September', 'October', 'November', 'December'
			]

			var gid = this.data.getImage(image)
			var next = this.data.getImage(gid, 'next')

			cur = this.images[gid]	
			next = this.images[next]

			if(cur && next && cur.birthtime.getMonth() != next.birthtime.getMonth()){
				this.ribbons.getImageMarks(gid).filter('.partition').remove()
				this.ribbons.getImage(gid)
					.after(this.ribbons.elemGID($('<div class="mark partition">'), gid)
						.attr('text', month[next.birthtime.getMonth()])) } }],


	exampleEmbededLister: ['Test/50: Lister example (embeded)/*',
		function(path, make){
			make('a/')
			make('b/')
			make('c/') }],
	exampleFloatingLister: ['Test/50:Lister example (floating)...',
		function(path){
			// we got an argument and can exit...
			if(path){
				console.log('PATH:', path)
				return }

			// load the UI...
			var that = this
			var list = function(path, make){
				make('a/')
				make('b/')
				make('c/') }

			var o = overlay.Overlay(this.dom, 
				browse.makePathList(null, {
					'a/*': list,
					'b/*': list,
					'c/*': list,
				})
				.open(function(evt, path){ 
					o.close() 

					that.exampleFloatingLister(path)
				}))

			return o }],


	// XXX BUG: right limit indicator can get covered by the scrollbar...
	// XXX migrate to the dialog framework...
	// XXX use this.dom as base...
	// XXX BUG: this breaks keyboard handling when closed...
	showTaggedInDrawer: ['- Test/Show tagged in drawer',
		function(tag){
			tag = tag || 'bookmark'
			var that = this
			var H = '200px'

			var viewer = $('<div class="viewer">')
				.css({
					height: H,
					background: 'black',
				})
				.attr('tabindex', '0')
			// XXX use this.dom as base...
			// XXX when using viewer zoom and other stuff get leaked...
			var widget = drawer.Drawer($('body'), 
				$('<div>')
					.addClass('image-list-widget')
					.css({
						position: 'relative',
						height: H,
					})
					.append(viewer),
				{
					focusable: true,
				})
				.on('close', function(){
					if(that.nested){
						that.nested.stop()
						delete that.nested } })


			var data = this.data.crop(this.data.tagQuery(tag), true)

			// setup the viewer...
			this.nested = core.ImageGridFeatures
				// setup actions...
				.setup([
					'imagegrid-ui-preview',
				])
				.run(function(){
					this.close = function(){ widget.close() }

					this.config['keyboard-event-source'] = viewer 

					// XXX hack -- need a better way to set this (a setter?)...
					this.__keyboard_config = {
						'Basic Control': {
							pattern: '*',

							Home: 'firstImage!',
							End: 'lastImage!',
							Left: 'prevImage!',
							ctrl_Left: 'prevScreen!',
							meta_Left: 'prevScreen!',
							PgUp: 'prevScreen!',
							PgDown: 'nextScreen!',
							Right: 'nextImage!',
							ctrl_Right: 'nextScreen!',
							meta_Right: 'nextScreen!',

							Esc: 'close!',
						},
					} })
				// load some testing data...
				.load({
					viewer: viewer,
					data: data,
					images: this.images, 
				})
				.fitImage(1)
					// XXX for some reason this is not called...
					.refresh()
				// link navigation...
				.on('focusImage', function(){
					that.focusImage(this.current) })
				// start things up...
				.start()
				.focusImage()

			// XXX need to focus widget -- use a real trigger event instead of timer...
			setTimeout(function(){
				that.nested.dom.focus() }, 200)

			return this.nested }],
	showBookmarkedInDrawer: ['Test/Show bookmarked in drawer',
		function(){ this.showTaggedInDrawer('bookmark') }],
	showSelectedInDrawer: ['Test/Show marked in drawer',
		function(){ this.showTaggedInDrawer('marked') }],


	makePartitionAfter: ['Test/Make Partition after image',
		function(image, text){
			var gid = this.data.getImage(image || 'current')
			var attrs = {
				gid: gid
			}
			if(text){
				attrs.text = text }
			this.ribbons.getImage(gid)
				.after($('<span>')
					.addClass('mark partition')
					.attr(attrs)) }],

	// Combined dialog/lister...
	//
	// XXX should this be made into a constructor???
	exampleDialogLister: ['Test/Combined dialog & lister (dialog mode)',
		widgets.makeUIDialog(function(path, make){
			var makeList = function(_, make){
				make('A')
				make('B')
				make('C') }

			return make instanceof Function ?
				makeList(path, make)
				: browse.makeLister(null, makeList) })],
	exampleDialogListerL: ['Test/Combined dialog & lister (lister mode)/*',
		'exampleDialogLister: ...'],


	testList: ['Test/List/*',
		function(path, make){ return function(){
			make('A')
			make('B')
			make('C') } }],


	// XXX should this use widgets.makeUIDialog(..)
	// 		...BUG: currently it creates a second overlay...
	exampleEditor: ['Test/Universal $editor...',
		widgets.uiDialog(function(spec, callback){
			return this.showEditor(
				spec || [
					// basic field...
					[['Basic static field: ', 'value']],

					{ title: '$Toggle: ',
						type: 'toggle', },
					{ title: 'Direct toggle: ',
						type: 'toggle',
						values: ['a', 'b', 'c'],
						list: false, },
					{ title: '$List toggle: ',
						type: 'toggle',
						values: ['first', 'second', 'third', 'last'], },
					{ title: '$Editable list toggle: ',
						type: 'toggle',
						values: ['sortable', 'renamable', 'removable', 'extendable'],
						list_editable: true, },

					'---',

					{ title: 'Theme (config): ',
						type: 'configToggle',
						key: 'theme',
						values_key: 'themes',
						// optional...
						live_update: true,
						callback: function(cfg, value){
							this.toggleTheme(value) }, },
					{ title: 'Theme (toggler): ',
						type: 'toggler',
						toggler: 'toggleTheme',
						// optional...
						live_update: true, },
					{ title: 'Slideshow direction: ',
						type: 'toggler',
						toggler: 'toggleSlideshowDirection', },
				], 
				callback || function(res, spec){
					console.log('EDITED:', res, spec) }) })],
	exampleEmbededEditor: ['Test/Universal editor (embeded)...',
		widgets.makeUIDialog(function(){
			var that = this
			var spec

			return browse.makeLister(null, function(_, make){

					that.showEditor(make, 
						// NOTE: we need to maintain the data between updates...
						spec = spec 
							|| [
								{ title: '$Toggle: ',
									type: 'toggle', },
								{ title: 'Direct toggle: ',
									type: 'toggle',
									values: ['a', 'b', 'c'],
									list: false, },
								{ title: '$List toggle: ',
									type: 'toggle',
									values: ['first', 'second', 'third', 'last'], },
								{ title: '$Editable list toggle: ',
									type: 'toggle',
									values: ['sortable', 'renamable', 'removable', 'extendable'],
									list_editable: true, }, 
								'---',
								{ title: 'Theme (toggler): ',
									type: 'toggler',
									toggler: 'toggleTheme',
									// optional...
									live_update: true, },
								// XXX BUG: toggler with two values does not seem to work...
								{ title: 'Slideshow direction: ',
									type: 'toggler',
									toggler: 'toggleSlideshowDirection', },
							])

					make.Separator()

					make('Done', {open: function(){ make.dialog.close() }})
				}, { cls: 'table-view' }) })],

	exampleEditor2: ['Test/Universal Editor (2)...',
		widgets.makeUIDialog(function(spec, callback){
			var that = this
			var d0 = {}
			var b1, b2
			return browse.makeLister(null, function(path, make){

				make([
					'Action count:',
					function(){
						return that.actions.length }, ])


				make.field('Fieatures:',
					function(){
						return that.features.features.length })

				make.field('A', 'B')

				//make.field.Toggle('Toggle: ', 'on')
				make.field.Toggle('Toggle: ', d0)

				make.batch(b1 = b1 || [
					'---',
					[['X', 'Y']],
					{title: 'foo', value: 123},
					{type: 'field.Toggle', title: 'Batch toggle 1: '},
				])
				make.field.batch(
					b2 = b2 || [
						'---',
						['X', 'Y'],
						{type: 'Toggle', title: 'foo', values: ['1','2','3'], list: false},
						{type: 'Toggle', title: 'foo (w. list)', values: ['1','2','3']},
						{type: 'Toggle', title: 'Batch toggle 2: '},
					], 
					function(){
						console.log('-- (2nd batch) --', ...arguments) })
			}, {
				cls: 'table-view',
			}) })],
})

var ExampleUI = 
module.ExampleUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-action-examples',
	depends: [
		'ui-browse-actions',
	],
	suggested: [
		'ui-action-examples-2',
	],
	actions: ExampleUIActions,

	handlers: [
	],
})



//---------------------------------------------------------------------

var ExampleUI2Actions = actions.Actions({
	testList: ['Test/List/*',
		function(path, make){ return function(){
			make('---')
			make('X')
			make('Y')
			make('Z') } }],
})

var ExampleUI = 
module.ExampleUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-action-examples-2',
	depends: [
		'ui-action-examples',
	],
	actions: ExampleUI2Actions,

	handlers: [
	],
})


//---------------------------------------------------------------------

core.ImageGridFeatures.Feature('examples', [
	'action-examples',
	'ui-action-examples',
])




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
