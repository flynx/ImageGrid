/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(process) != 'undefined'){
	var file = require('imagegrid/file')
}

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// Comments...
// XXX these are quite generic, might be a good idea to move them out of fs...

var CommentsActions = actions.Actions({
	// Format:
	// 	{
	// 		// raw loaded comments...
	// 		raw: {
	// 			<path>: <comments>,
	// 			...
	// 		},
	//
	// 		<keyword>: <data>,
	// 		...
	// 	}
	__comments: null,

	get comments(){
		return this.__comments },
	set comments(value){
		this.__comments = value },
})

var Comments = 
module.Comments = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'comments',

	actions: CommentsActions,

	handlers: [
		// save/resore .comments
		['json',
			function(res){
				if(this.comments != null){
					res.comments = JSON.parse(JSON.stringify(this.comments)) } }],
		['load',
			function(_, data){
				if(data.comments != null){
					this.comments = data.comments } }],

		// prepare comments for saving to "comments/<keyword>"...
		//
		// NOTE: this will skip the 'raw' comment field...
		// NOTE: we do not change the .json() format here, so we do not 
		// 		need to do anything special to restore, i.e. no need for
		// 		doing anything on .prepareIndexForLoad(..)
		['prepareIndexForWrite',
			function(res){
				var changed = res.changes === true
					|| res.changes.comments

				if(changed && res.raw.comments){
					var comments = res.raw.comments

					Object.keys(comments)
						// skip the raw field...
						.filter(function(k){ return k != 'raw' })
						.forEach(function(k){
							res.index['comments/' + k] = comments[k] }) } }],
	],
})



//---------------------------------------------------------------------
// FS Comments... 

// XXX split this to loader and writer???
var FileSystemCommentsActions = actions.Actions({
	config: {
		// Comment loading delay...
		//
		// This helps prevent the comment loading process from delaying
		// showing the user the images...
		//
		// NOTE: to load without a delay set this to -1.
		'comments-delay-load': 100,
	},

	/* XXX we do not actually need this...
	// XXX this will not save comments for merged indexes...
	saveComments: ['- File/',
		function(path, date, logger){
			if(this.location.load != 'loadIndex' 
				|| this.location.loaded.length > 1){
				return
			}

			logger = logger || this.logger
			logger = logger && logger.push('saveComments')

			var path = this.location.path
			var comments_dir = this.config['index-dir'] +'/comments'
			var data = JSON.parse(JSON.stringify(this.comments))

			// XXX
			return file.writeIndex(
					data, 
					path +'/'+ comments_dir,
					date || Date.timeStamp(),
					this.config['index-filename-template'], 
					logger)
		}],
	//*/
	loadComments: ['- File/',
		function(path, date, logger){
			if(this.location.load != 'loadIndex'){
				return }

			logger = logger || this.logger
			logger = logger && logger.push('Load comments')

			var that = this
			var loaded = this.location.loaded

			// prepare empty comments...
			// XXX should we reset or just merge???
			this.comments = { raw: {} }

			return Promise.all(loaded.map(function(path){
				var comments_dir = that.config['index-dir'] +'/comments'

				return file.loadIndex(path +'/'+ comments_dir, false, date, logger)
					.then(function(res){
						var c = res[path +'/'+ comments_dir]

						// no comments present...
						if(c == null){
							return res }

						// if we have no sub-indexes just load the 
						// comments as-is...
						if(loaded.length == 1){
							that.comments = JSON.parse(JSON.stringify(c))
							that.comments.raw = {path: c}

						// sub-indexes -> let the client merge their stuff...
						} else {
							that.comments.raw[path] = c } 

						return res }) })) }],
})


var FileSystemComments = 
module.FileSystemComments = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-comments',
	depends: [
		'comments',
		'fs-loader',
	],

	actions: FileSystemCommentsActions,

	handlers: [
		['loadIndex',
			function(res){
				var that = this
				var delay = that.config['comments-delay-load']

				res.then(
					function(){
						delay < 0 ?
							that.loadComments()
							: setTimeout(function(){
								that.loadComments() }, delay || 0) },
					function(){}) }],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
