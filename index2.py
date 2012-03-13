#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120313224544'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------
# The first index.py might be a little too complicated. try and resolve
# this as so:
# 	- list all relevant files (RAW, XMP, JPG, PSD, ...)
# 	- group by path (closeness)
# 		- deepest common path to contain all files with common name.
# 		  this will fail if we have different files with same names.
#
#-----------------------------------------------------------------------

import os
import json
import zipfile
import uuid
import time
from pprint import pprint
from itertools import izip, izip_longest

import pyexiv2 as metadata

from pli.logictypes import ANY, OR

import store
from gid import image_gid


#-----------------------------------------------------------------------

##CONFIG_NAME = 'test_config.json'
##CONFIG_NAME = 'tmp_config.json'
CONFIG_NAME = 'tmp_config.json.bak'

config = json.load(open(CONFIG_NAME))

# XXX move this to a context-dependant module...
RAW = OR(
	'NEF', 'nef', 
	'CRW', 'crw',
	'CR2', 'cr2',
	'X3F', 'x3f',
	'DNG', 'dng',
)

JPEG = OR(
	'JPG', 'jpg', 
	'JPEG', 'jpeg',
)

PSD = OR(
	'PSD', 'psd'
)

TIFF = OR(
	'TIFF', 'tiff', 
	'TIF', 'tif'
)

XMP = OR(
	'XMP', 'xmp'
)

ITEM = OR(RAW, JPEG, PSD, TIFF, XMP)

TYPES = {
	'raw': RAW,
	'jpeg': JPEG,
	'psd': PSD,
	'tiff': TIFF,
	'xmp': XMP,
}


SUBTREE_CLASSES = {
	'preview': 'preview', 
	'preview (RAW)': 'RAW preview', 
}


#-----------------------------------------------------------------------



##!!! we will need to normalize the paths to one single scheme (either relative or absolute)...
# XXX might need to fetch file data too...
def list_files(root, sub_trees=SUBTREE_CLASSES, type=ITEM, include_root_path=False, include_ctime=True):
	'''
	yields:
		(<path>, <name>, <ext>[, <ctime>]),
	'''
	for orig_path, dirs, files in os.walk(root):
		# XXX is this correct...
		path = orig_path.split(os.path.sep)
		# remove root from path...
		if not include_root_path:
			path = path[len(root.split(os.path.sep)):]
		# process files...
		for f in files:
			name, ext = os.path.splitext(f)
			# we need the extension wothout the dot...
			ext = ext[1:]
			# filter by ext...
			if ext == type:
				if include_ctime:
					t = os.path.getctime(os.path.join(orig_path, f))
					yield path, name, ext, t
				else:
					yield path, name, ext


def common_len(a, *b):
	'''
	'''
	for i, l in enumerate(izip(*(a,) + b)):
		if len(set(l)) != 1:
			return i
	return len(min(*(a,) + b))


##!!! is this meaningless?
def path_distance(a, b):
	'''
	'''
	return len(a) + len(b) - common_len(a, b)*2


def index_by_name(lst):
	'''
	index by file name (indexing preparation)...

	format:
	{
		<name> : [
			(<path>, <name>, ...),
			...
		],
		...
	}
	'''
	res = {}
	# NOTE: this is to avoid side-effects...
	lst = lst[:]
	# sort via name, ext, path
	lst.sort(key=lambda e: (e[1], e[2], e[0]))
	for e in lst:
		n = e[1]
		if n in res:
			res[n] += [e]
		else:
			res[n] = [e]
	return res



def split_by_raws(raws, lst, failed):
	'''
	'''
##	raws = [e for e in lst if e[2] == RAW] 
	common = common_len(*[ e[0] for e in raws ])

	# NOTE: do not change the order of raws after this point
	# 		and till the end of the loop...
	# 		XXX revise if there is a simpler way...
	##!!! this kills code like sets[0][1] += [...]
##	sets = [ (r, [r]) for r in raws ]
	sets = [ [r, [r]] for r in raws ]

	for e in lst:
		if e[2] == RAW:
			continue
		# check if we are closer to other raws...
		# NOTE: this depends on stability of order in raws
		c_index = [(common_len(r[0], e[0]), r, i) for i, r in enumerate(raws)]
		c, raw, i = max(*c_index)
		# we have two locations with identical weight...
		if c_index.count([c, ANY, ANY]) > 1:
			# a file is at a path junction exactly...
			print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
			##!!! try different strategies here...
			##!!!
			failed += [e]
		# found a location...
		elif c > common:
			##!!! for some odd reason this does not work....
			sets[i][1] += [e]
		# file in an odd location ##!!! list these locations...
		else:
			print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
			##!!! try different strategies here...
			##!!!
			failed += [e]
##	return sets, failed
	return sets


def gid_index(index, existing=None):
	'''
	'''
	# index via a propper GID...
	# split similarly named but different files...
	if existing is None:
		res = {}
	else:
		res = existing
	failed = []
	for name, l in index.iteritems():
		l.sort()
		raws = [e for e in l if e[2] == RAW] 

		# multiple raw files...
		if len(raws) > 1:
			# spit this into a seporate func...
			sets = split_by_raws(raws, l, failed)
		# single raw...
		elif len(raws) == 1:
			sets = [(raws[0], l)]
		# no raw files...
		else:
			print 'no raw file found for "%s"...' % os.path.join(name)
			sets = []
			##!!! need to report this in a usable way...
			failed += l

		# add actual elements to index...
		for raw, l in sets:
			# get file GID...
			GID = image_gid('%s.%s' % (os.path.join(*[config['ARCHIVE_ROOT']] + raw[0] + [raw[1]]), raw[2]))

			res[GID] = {
				'gid': GID,
				'name': name,
				'imported': time.time(),
				# NOTE: this might get distorted on archiving or
				# 		copying...
				# 		mostly intended for importing...
				'ctime': raw[3], 
				##!!! make these more general...
				'RAW': [e for e in l if e[2] == RAW],
				'XMP': [e for e in l if e[2] == XMP],
				'JPG': [e for e in l if e[2] == JPEG],
				'PSD': [e for e in l if e[2] == PSD],
				'TIFF': [e for e in l if e[2] == TIFF],
				'other': [e for e in l if e[2] != OR(TIFF, PSD, JPEG, XMP, RAW)],
			}

	return res, failed


#-----------------------------------------------------------------------
if __name__ == '__main__':

	INDEX_PATH = os.path.join('test', 'index2')

	FILE_LIST = os.path.join('test', 'flatfilelist.json')
	BUILD_FILE_LIST = False if os.path.exists(FILE_LIST) else True


	if BUILD_FILE_LIST:
		lst = list(list_files(config['ARCHIVE_ROOT']))
	
		print 'found files:', len(lst)
		pprint(lst[0])
	
		json.dump(lst, file(FILE_LIST, 'w'))
		print 'saved...'

	lst = json.load(file(FILE_LIST))
	print 'loaded:', len(lst)


	index = index_by_name(lst)


##	GID_index = store.IndexWithCache(INDEX_PATH)
	GID_index = store.Index(INDEX_PATH)

	GID_index, failed = gid_index(index, GID_index)

	json.dump(failed, file(os.path.join('test', 'failed-to-categorise.json'), 'w'))



	##!!! TODO: archive descriptions to help index/tag items...

	# NOTE: each import from an existing archive will be as follows:
	# 			- full listing
	# 			- find new subtrees
	# 			- find modified items (file date diff)
	
	# NOTE: raws number here may be more than indexed because some raws 
	# 		may get grouped by GID
	print '''results:
	indexed: %s
	raws: %s
	failed: %s
	''' % (
			len(GID_index), 
			len([ e for e in lst if e[2] == RAW]), 
			len(failed))

	pprint(GID_index.values()[0])

	store.save_file_index(GID_index, INDEX_PATH)

##	store.pack_file_index(INDEX_PATH)






#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
