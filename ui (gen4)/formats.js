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
	data.ribbons.forEach(function(input_images, i){
		var ribbon = []
		ribbons.push(ribbon)
		for(var id in input_images){
			var image = input_images[id]
			ribbon.push(id)
			order.push(id)
			images[id] = image
		}
		cmp && ribbon.sort(cmp)
	})

	cmp && order.sort(cmp)

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
//
module.VERSIONS['3.0'] =
function(data){
	data = data.version < '2.0' ? module.VERSIONS['2.0'](data) : data

	// XXX is this the right way to go???
	var that = require('data').Data()

	var res = {}
	res.version = '3.0'
	res.current = data.current
	res.order = data.order.slice()
	res.ribbon_order = data.ribbon_order == null ? [] : data.ribbon_order.slice()
	res.ribbons = {} 
	// generate gids...
	// NOTE: this will use the structures stored in data if available, 
	// 		otherwise new structures will be generated...
	// NOTE: we need to do this anyway as we also need to deep-copy the 
	// 		ribbons...
	var keys = data.ribbon_order != null 
		? data.ribbon_order 
		: Object.keys(data.ribbons)
	keys.forEach(function(k){
		var gid = k*1 == null ? k : that.newGid()
		res.ribbon_order.push(gid)
		res.ribbons[gid] = data.ribbons[k].slice()
	})
	// we set the base to the first ribbon...
	res.base = data.base == null ? res.ribbon_order[0] : res.base
	return res
}



/* This is best kept as a separate entity...
// XXX EXPERIMENTAL...
module.VERSIONS['3.1'] =
function(data){
	res = module.VERSIONS['3.0'](data)

	res.version = '3.1'
	res.order_list = data.order_list != null ? JSON.parse(JSON.stringify(data.order_list)) : null

	return res
}
*/



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
