#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20111103010916'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import json

from pli.logictypes import OR


#-----------------------------------------------------------------------

CONFIG_NAME = 'config.json'

config = json.load(open(CONFIG_NAME))

ITEM_EXTENSIONS = (
	# RAW formats...
	'NEF', 'nef',
	# JPEGs...
	'JPG', 'JPEG', 'jpg', 'jpeg',
	# Editid images...
	'PSD', 'psd',
	'TIFF', 'tiff', 'TIF', 'tif',
	# metadata sidecar files...
	'XMP', 'xmp',
)

SUBTREE_CLASSES = {
	'preview': 'preview', 
	'preview (RAW)': 'RAW preview', 
}


#-----------------------------------------------------------------------

def list_files(root, sub_trees=SUBTREE_CLASSES, ext=OR(*ITEM_EXTENSIONS)):
	'''
	'''
	for path, dirs, files in os.walk(root):
		# clasify by subtree...
		p = os.path.split(path)
		subtree_type = None 
		for t in sub_trees:
			if t in p:
				subtree_type = sub_trees[t]
				break
		# process files...
		for f in files:
			# filter by ext...
			if f.split('.')[-1] == ext:
				yield subtree_type, path, f



#-----------------------------------------------------------------------
if __name__ == '__main__':
	lst = list(list_files(config['ARCHIVE_ROOT']))

	print len(lst)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
