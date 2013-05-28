
function toggleMarkers(){
	var marker = $('.v-marker, .h-marker')
	if(marker.css('display') == 'none'){
		marker.fadeIn()
	} else {
		marker.fadeOut()
	}
}

