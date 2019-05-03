/**********************************************************************
* 
*
*
**********************************************************************/
var requirejs_cfg = {
	// XXX this does not work on direct filesystem access...
	//urlArgs: 'bust='+Date.now(),
	
	paths: {
		text: 'node_modules/requirejs-plugins/lib/text',
		json: 'node_modules/requirejs-plugins/src/json',
		
		//react: 'node_modules/react/dist/react-with-addons.min.js',
		//'react-dom': 'node_modules/react-dom/dist/react-dom.min.js',
		//'ext-lib/preact': './node_modules/preact/dist/preact.dev',

		'lib/object': 'node_modules/ig-object/object',
		'lib/actions': 'node_modules/ig-actions/actions',
		'lib/features': 'node_modules/ig-features/features',
		//'lib/keyboard': './node_modules/ig-keyboard/keyboard',
		
		'lib/walk': 'node_modules/generic-walk/walk',
	},	
	map: {
		'*': {
			// back-refs
			// ...these enable the npm modules reference each other in 
			// a cross-platform manner....
			'ig-object': 'lib/object',
			'ig-actions': 'lib/actions',
			'ig-features': 'lib/features',

			//'ig-keyboard': 'lib/keyboard',

			'generic-walk': 'lib/walk',
		},
	},
}


if(typeof(require) != 'undefined'){
	requirejs_cfg.nodeRequire = require
	//requirejs_cfg.baseUrl = __dirname
}


// XXX revise...
if(typeof(require) != 'undefined' && typeof(global) != 'undefined'){
	global.requirejs = global.requirejs || require('requirejs')
}


requirejs.config(requirejs_cfg)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
