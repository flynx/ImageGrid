/**********************************************************************
* 
*
*
**********************************************************************/

if(typeof(process) != 'undefined'){
	var glob = require('glob')
}


//var DEBUG = DEBUG != null ? DEBUG : true
//
define(function(require){ var module = {}


var data =
module.data = 
	require('data')

var images = 
module.images = 
	require('images')

var ribbons = 
module.ribbons = 
	require('ribbons')

var v =
module.v = 
	require('viewer')



/*********************************************************************/


var mock_data =
module.mock_data = {
	varsion: '3.0',

	current: '3',
	base: 'r0',

	order: [],

	ribbon_order: ['r0', 'r1'],
	ribbons: {
		r1: ['1', '2', '3'],
		r0: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
			 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x',
			 'y', 'z']
	},

	tags: {
		selected: ['b', 'z'],
		bookmark: ['1', 'c', 'z'],
	},

	// NOTE: group gids do not have to be present in .order, they will 
	// 		get added on .collapseGroup(..)...
	groups: {
		g0: ['a', 'b', 'c'],
		g1: ['l', 'y'],
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
module.setupActions = function(viewer){
	viewer = viewer == null ? $('.viewer') : viewer
	//r = r == null ? makeTestRibbons(viewer, images) : r

	var vv = Object.create(v.Client)

	// XXX need to automate this...
	vv.config = Object.create(vv.config || {})

	return vv
}


/*********************************************************************/
// node.js specific stuff...
if(typeof(glob) != 'undefined'){

	window.load2014 = function(){
		return a.loadImages('l:/media/img/my/2014/')
		//return glob('l:/media/img/my/2014/*jpg')
		//	.on('end', function(l){ window.a.loadURLs(l) })
	}


	window.loadInsta = function(){
		return a.loadImages('l:/mnt/Dropbox/Instagram/fav/ALL/')
		//return glob('l:/mnt/Dropbox/Instagram/fav/ALL/*+(jpg|png)')
		//	.on('end', function(l){ window.a.loadURLs(l) })
	}


	window.loadMBFWR1 = function(logger){
		a.loadIndex('L:/mnt/hdd15 (photo)/NTFS2/media/img/my/work/20151022 - MBFWR (1),/preview (RAW)/', logger)
	}


	/*
	window.loadSaved = function(){
		a.data.loadJSON(require('fs').readFileSync('insta.json', 'utf-8'))
	}
	*/

}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
