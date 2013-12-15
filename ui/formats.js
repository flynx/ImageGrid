/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// Convert legacy Gen1 data format to current Gen3 (v2.0)
function convertDataGen1(data, cmp){
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







/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
