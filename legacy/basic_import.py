#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20111015034511'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import shutil
import Image
import tempfile
import pyexiv2

import tags


#-----------------------------------------------------------------------

INPUT_PATH = r'L:\mnt\hdd9 (photo)\NTFS2\work\ImageGrid\staging\input'
ARCHIVE_PATH = r'L:\mnt\hdd9 (photo)\NTFS2\work\ImageGrid\staging\archive'

THUMB_SIZE = 200
PREVIEW_SIZE = 900

HIRES_DIR = 'hires'
THUMBS_DIR = 'thumb'
PREVIEW_DIR = 'preview'
TMP_DIR = 'tmp'


#-----------------------------------------------------------------------

def setup_archive(path):
	'''
	build directory tree and setup initial data.
	'''
	pass


##!!! need to select propper dir for preview...
# this should:
#	- create thumbnail						- DONE
#	- create preview						- DONE
#	- extract metadata						- DONE
#	- populate EXIF/IPTC of preview images	- DONE
#	- add path to preview/thumb				- DONE
#	- generate tags							##!!!
#
def import_image(path):
	'''
	import a single image.

	'''
	# get the filename...
	file_name = os.path.split(path)[-1]
	file_name_base = file_name.split('.')[0]

	# start with metadata...
	metadata = pyexiv2.ImageMetadata(path)
	metadata.read()
	
	# add path to the original as a comment...
	if metadata['Exif.Photo.UserComment'].value.strip() == '':
		metadata['Exif.Photo.UserComment'] = 'RAW path: ' + os.path.abspath(path)
	else:
		metadata['Exif.Photo.UserComment'] = preview_metadata['Exif.Photo.UserComment'].value + '\n\nRAW path: ' + os.path.abspath(path)

	# extract preview from raw file (largest)...
	orig_preview_path = os.path.join(ARCHIVE_PATH, HIRES_DIR, file_name)
##	orig_preview = metadata.previews[-1]
##	orig_preview.write_to_file(orig_preview_path)

	##!!! HACK: use a lib instead of exec-ing a command for each image...
	cmd = 'exiv2 -f -l "%s" -ep%s "%s"' % (
		os.path.join(ARCHIVE_PATH, TMP_DIR),
		len(metadata.previews),
		path
		)
	os.system(cmd)
	##!!! HACK: guessing the file name...
	orig_preview_path = os.path.join(ARCHIVE_PATH, TMP_DIR, '%s-preview%s.jpg' % (
																	file_name_base,
																	len(metadata.previews)))

	# generate preview and save to preview dir...
	preview_path = os.path.join(ARCHIVE_PATH, PREVIEW_DIR, file_name_base)
	orig = Image.open(orig_preview_path)
	scale = PREVIEW_SIZE/float(max(*orig.size))
##	preview = orig.resize((int(orig.size[0]*scale), int(orig.size[1]*scale)), Image.BICUBIC)
	preview = orig.resize((int(orig.size[0]*scale), int(orig.size[1]*scale)), Image.ANTIALIAS)
	preview.save(preview_path + '.jpg')

	preview_metadata = pyexiv2.ImageMetadata(preview_path + '.jpg')
	preview_metadata.read()
	metadata.copy(preview_metadata)
	preview_metadata.write()


	# generate thumb and save to thumb dir...
	thumb_path = os.path.join(ARCHIVE_PATH, THUMBS_DIR, file_name_base)
	preview.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.ANTIALIAS)
	preview.save(thumb_path + '.jpg')

	thumb_metadata = pyexiv2.ImageMetadata(thumb_path + '.jpg')
	thumb_metadata.read()
	metadata.copy(thumb_metadata)
	thumb_metadata.write()

	##!!! tag stuff...
	##!!!



def import_dir(path):
	'''
	'''




#-----------------------------------------------------------------------

if __name__ == '__main__':

	import_image(os.path.join('test', 'RAW.NEF'))



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
