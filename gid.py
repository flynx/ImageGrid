#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120310183438'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os

import pyexiv2 as metadata


#-----------------------------------------------------------------------

# XXX need a strategy to check if two files that have the same GID are
# 	  identical, and if so, need to destinguish them in the GID...
# 	  might be a good idea to add a file hash
# XXX not yet sure if this is unique enough to avoid conflicts if one
# 	  photographer has enough cameras...
# XXX also might be wise to add a photographer ID into here...
def image_gid(path, format='%(artist)s-%(date)s-%(name)s', date_format='%Y%m%d-%H%M%S'):
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

	Supported fields:
		%(artist)s	- Exif.Image.Artist field, stripped and spaces replaced with underscores.
		%(date)s	- Exif.Image.DateTime formated to date_format argument.
		%(name)s	- file name.

	NOTE: date and time are the date and time the image was made ('Exif.Image.DateTime')
	NOTE: need EXIF data to generate a GID
	'''
	# get the filename...
	data = {
		'name': os.path.splitext(os.path.split(path)[-1])[0],
	}
	# check if we need a date in the id...
	if '%(date)s' in format:
		i = metadata.ImageMetadata('%s' % path)
		i.read()
		d = i['Exif.Image.DateTime'].value
		data['date'] = d.strftime(date_format)
	# check if we need an artist...
	if '%(artist)s' in format:
		data['artist'] = i['Exif.Image.Artist'].value.strip().replace(' ', '_')
	
	return format % data



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
