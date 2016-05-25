/**********************************************************************
* 
*
*
**********************************************************************/

var requirejs = require('requirejs')
requirejs.config({
	nodeRequire: require,
	baseUrl: process.cwd(),
})



/*********************************************************************/

requirejs(['lib/preview'], function(preview){
	process.on('message', function(m){
		preview.makePreviews(
				m.images, 
				m.sizes, 
				m.base_path, 
				m.target_tpl, 
				function(err, data){
					// XXX send the data back to parent...
					process.send({ticket: m.ticket, err: err, data: data})
				})
			/*
			.catch(function(err){
				// XXX
			})
			*/
			.then(function(){
				process.send({ticket: m.ticket, status: 'completed'})
			})
	})
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
