#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130322142905'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import sha
import md5
import base64
import time

import pyexiv2 as metadata


#-----------------------------------------------------------------------

# XXX need a strategy to check if two files that have the same GID are
# 	  identical, and if so, need to destinguish them in the GID...
# 	  might be a good idea to add a file hash
# XXX not yet sure if this is unique enough to avoid conflicts if one
# 	  photographer has enough cameras...
# XXX also might be wise to add a photographer ID into here...
##!!! add gid info section to identify the options used to greate a gid, e.g. EXIF date vs. ctime, etc.
##!!! do a general revision and remove leacy...
def image_gid(path, date=None, 
		format='%(artist)s-%(date)s-%(name)s', 
		date_format='%Y%m%d-%H%M%S', 
		default_artist='Unknown',
		use_ctime=False,
		hash_func=lambda s: sha.sha(s).hexdigest()):
	'''
	Calculate image GID.

	Main gid criteria:
	 	- unique
	 	- calculable from the item (preferably any sub-item)
	 	- human-readable

	Default format:
		<artist>-<datetime>-<filename>

	Example:
		Alex_A.Naanou-20110627-195706-DSC_1234	

	If hash_func is not None, then the function will be used to generate 
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
	try:
		i.read()
	except IOError:
		# can't read exif...
		i = None
	# check if we need a date in the id...
	if '%(date)s' in format:
		if date is not None:
			data['date'] = time.strftime(date_format, time.gmtime(date))
		elif use_ctime or i is None:
			date = os.path.getctime(path)
			data['date'] = time.strftime(date_format, time.gmtime(date))
		else:
##			date = i['Exif.Image.DateTime'].value
			date = i['Exif.Photo.DateTimeOriginal'].value
			data['date'] = date.strftime(date_format)
	# check if we need an artist...
	if '%(artist)s' in format:
		data['artist'] = default_artist
		if i is not None:
			try:
				data['artist'] = i['Exif.Image.Artist'].value.strip().replace(' ', '_')
			except KeyError:
				pass
	
	if hash_func is not None:
		return hash_func(format % data)
	return format % data



#-----------------------------------------------------------------------
if __name__ == '__main__':
	from optparse import OptionParser

	parser = OptionParser()

	##!!! need to define the path so that it shoes up in -h

	parser.add_option('-t', '--text',
						dest='format',
						action='store_const',
						const='text',
						default='sha',
						help='output GUID in base64 format.')
	parser.add_option('-b', '--base64',
						dest='format',
						action='store_const',
						const='base64',
						default='sha',
						help='output GUID in text format.')
	parser.add_option('-s', '--sha',
						dest='format',
						action='store_const',
						const='sha',
						default='sha',
						help='output GUID in sha format.')

	options, args = parser.parse_args()

	if len(args) != 1:
		parser.print_usage()
	else:
		IN_PATH = args[0]
		IN_PATH = IN_PATH.replace('\\', '/')

		if options.format == 'text':
			print image_gid(IN_PATH, hash_func=None)
		elif options.format == 'base64':
			# also remove the trailing \n...
			print image_gid(IN_PATH, hash_func=lambda s: base64.encodestring(s).strip())
		else:
			print image_gid(IN_PATH)



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
