/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> formats')


module.VERSIONS = []



/*********************************************************************/


// Convert legacy Gen1 data format to Gen3 format version 2.0+
//
// XXX external deps:
// 		imageDateCmp
//module.convertDataGen1 =
module.VERSIONS['2.0'] =
function(data, cmp){
	var res = {
		data: {
			version: '2.0',
			current: null,
			ribbons: [],
			order: [], 
		},
		images: {}
	}
	cmp = cmp == null ?
			function(a, b){ 
				return imageDateCmp(a, b, null, res.images) 
			}
			: cmp
	var ribbons = res.data.ribbons
	var order = res.data.order
	var images = res.images

	// position...
	res.data.current = data.position
	
	// ribbons and images...
	$.each(data.ribbons, function(i, input_images){
		var ribbon = []
		ribbons.push(ribbon)
		for(var id in input_images){
			var image = input_images[id]
			ribbon.push(id)
			order.push(id)
			images[id] = image
		}
		ribbon.sort(cmp)
	})

	order.sort(cmp)

	// XXX STUB
	res.data.current = order[0]

	return res
}


// Convert gen3 data to gen4 v3.0+...
//
// NOTE: this will just convert the JSON format and will not construct 
// 		the Data object...
// NOTE: this uses require('data').Data().newGid(..) for ribbon gid 
// 		generation...
//module.convertDataGen3 = 
module.VERSIONS['3.0'] =
function(data){
	data = data.version == null ? module.VERSIONS['2.0'](data) : data

	// XXX is this the right way to go???
	var that = require('data').Data()

	var res = {}
	res.version = '3.0'
	res.current = data.current
	res.order = data.order.slice()
	res.ribbon_order = []
	res.ribbons = {}
	// generate gids...
	data.ribbons.forEach(function(e){
		var gid = that.newGid('R')
		res.ribbon_order.push(gid)
		res.ribbons[gid] = e.slice()
	})
	// we set the base to the first ribbon...
	res.base = res.ribbon_order[0]
	return res
}


// Get latest updater version...
//
module.getLatestUpdaterVersion = function(){
	return Object.keys(module.VERSIONS).sort().pop()
}



/*********************************************************************/

// Update data (JSON) to latest version...
//
// This is the main entry point in this module.
//
// Takes any compatable JSON data version and converts it to the latest 
// format.
// NOTE: if data is already in the latest format this will return it 
// 		as-is.
module.updateData = function(data){
	var v = module.getLatestUpdaterVersion()
	return data.version < v
		? module.VERSIONS[v](data) 
		: data
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
