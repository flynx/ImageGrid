#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20110930190347'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import time
import uuid
import pickle
import pli.tags.tagset as tagset
from pli.logictypes import OR, ANY


#-----------------------------------------------------------------------
#
# basic data:
# 	Image:
# 	{
# 		'name': NAME,
# 		'title': TITLE,
#
# 		'preview': LINK,
# 		'original': LINK,
#
#
# 		'tags': [
# 			TAG, 
# 			...
# 		],
# 		'links': [
# 			...
# 		]
# 	}
#
#
#-----------------------------------------------------------------------
# basic patterns...

##!!!
IMAGE_ID = ANY
NAME = ANY
PATH = ANY

LINK_TYPE = OR('preview', 'original', 'image')

LINK = {
	'name': NAME,
	'path': PATH,
	'type': LINK_TYPE,
}

IMAGE = {
	'id': IMAGE_ID,
	'name': NAME,

	'preview': LINK,
	'original': LINK,

	'links': None,

	'metadata': None,
}



#-----------------------------------------------------------------------

index = {
	'tags': tagset.DictTagSet(),
	'paths': {},
}


def import_image(path, index):
	'''
	'''
	# create an ID...
	uid = uuid.uuid1()
	while uid in index['paths']:
		uid = uuid.uuid1()

	# add file to index...
	index['paths'][uid] = path
	index['tags'].tag(uid, 'type:image', 'image')

	return uid


if __name__ == '__main__':

	t = index['tags']

	t0 = time.time()
	print 'generating data...',

	for i in xrange(500):
		n = 'moo%05d' % i
		uid = import_image(n, index)
		if n[-1] == '0':
			t.tag(uid, '0')
		if n[-1] == '5':
			t.tag(uid, '5')
		if n.endswith('10'):
			t.tag(uid, '10')

	t1 = time.time()
	print 'done (%s).' % (t1 - t0)



	t0 = time.time()
	print 'saving data...',

	pickle.dump(index, open('dummy.index', 'w'))

	t1 = time.time()
	print 'done (%s).' % (t1 - t0)



	t0 = time.time()
	print 'loading data...',

	index = pickle.load(open('dummy.index'))

	t1 = time.time()
	print 'done (%s).' % (t1 - t0)


	from profile import run


	t0 = time.time()
	print 'getting number of elements...',

##	n = len(index['tags'].all('0').objects())
##	n = len(index['tags'].all('10').objects())
##	n = len(index['tags'].any('0', '10').objects())
##	n = len(index['tags'].all('0').none('10').objects())
##	n = len(index['tags'].all('type:image'))
	run('''n = len(index['tags'].all('type:image'))''')

	t1 = time.time()
	print 'done (%s).' % (t1 - t0)

	print 'and the number is:', n
	print 'tagset size is:', len(index['tags'])



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
