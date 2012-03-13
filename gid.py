#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120313223928'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import sha
import md5

import pyexiv2 as metadata


#-----------------------------------------------------------------------

# XXX need a strategy to check if two files that have the same GID are
# 	  identical, and if so, need to destinguish them in the GID...
# 	  might be a good idea to add a file hash
# XXX not yet sure if this is unique enough to avoid conflicts if one
# 	  photographer has enough cameras...
# XXX also might be wise to add a photographer ID into here...
def image_gid(path, format='%(artist)s-%(date)s-%(name)s', 
		date_format='%Y%m%d-%H%M%S', 
		default_artist='Unknown',
		hash_func=sha.sha):
	'''
	Calgulate image GID.

	Main gid criteria:
	 	- unique
	 	- calculable from the item (preferably any sub-item)
	 	- human-readable

	Default format:
		<artist>-<datetime>-<filename>

	Example:
		Alex_A.Naanou-20110627-195706-DSC_1234	

	If hash_func is not None, then the function will be used to henerate 
	a hex hash from the above string.

	Supported fields:
		%(artist)s	- Exif.Image.Artist field, stripped and spaces replaced
					  with underscores.
		%(date)s	- Exif.Image.DateTime formated to date_format argument.
		%(name)s	- file name.

	NOTE: date and time are the date and time the image was made ('Exif.Image.DateTime')
	NOTE: need EXIF data to generate a GID
	'''
	# get the filename...
	data = {
		'name': os.path.splitext(os.path.split(path)[-1])[0],
	}
	##!!! this might fail...
	i = metadata.ImageMetadata('%s' % path)
	i.read()
	# check if we need a date in the id...
	if '%(date)s' in format:
		d = i['Exif.Image.DateTime'].value
		data['date'] = d.strftime(date_format)
	# check if we need an artist...
	if '%(artist)s' in format:
		try:
			data['artist'] = i['Exif.Image.Artist'].value.strip().replace(' ', '_')
		except KeyError:
			data['artist'] = default_artist
	
	if hash_func is not None:
		return hash_func(format % data).hexdigest()
	return format % data



#-----------------------------------------------------------------------
if __name__ == '__main__':
	pass




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
