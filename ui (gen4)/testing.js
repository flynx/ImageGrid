/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true
//
define(function(require){ var module = {}
console.log('>>> testing')


var data =
module.data = 
	require('data')

var images = 
module.images = 
	require('images')

var ribbons = 
module.ribbons = 
	require('ribbons')

var actions =
module.actions = 
	require('actions')



/*********************************************************************/


var mock_data =
module.mock_data = {
	varsion: '3.0',

	current: 'b',
	base: 'x',

	order: [],

	ribbon_order: ['y', 'x'],
	ribbons: {
		x: ['1', '2', '3'],
		y: ['a', 'b', 'c', 'd', 'e', 'f', 'g']
	},
}
Object.keys(mock_data.ribbons).forEach(function(k){ 
	mock_data.order = mock_data.order.concat(mock_data.ribbons[k]) 
})

var test_data =
module.test_data = 
	data.Data.fromJSON(mock_data)


var makeTestRibbons =
module.makeTestRibbons = function(viewer, images){
	viewer = viewer == null ? $('.viewer') : viewer
	return ribbons.Ribbons(viewer, images)
}

var makeTestImages =
module.makeTestImages = function(data){
	return images.Images(data)
}


var loadTestRibbons =
module.loadTestRibbons = function(ribbons, data, images, viewer){
	images = images == null ? makeTestImages() : images
	ribbons = ribbons == null ? makeTestRibbons(viewer, images) : ribbons
	data = data == null ? module.mock_data : data
	return ribbons.updateData(data)
}


var setupActions =
module.setupActions = function(viewer, r){
	viewer = viewer == null ? $('.viewer') : viewer
	r = r == null ? makeTestRibbons(viewer, images) : r

	var a = actions.setupBaseActions(viewer, {})
	actions.setupUIActions(viewer, a)
	ribbons.setupActionHandlers(r, viewer, a)

	return a
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
