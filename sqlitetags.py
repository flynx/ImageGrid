#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20111116030109'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import sqlite3
import uuid

import pli.objutils as objutils
import pli.pattern.proxy.utils as putils

from pli.logictypes import ANY

import tags



#-----------------------------------------------------------------------

class SQLiteTagset(tags.AbstractTagSet):
	'''
	'''
	##!!! this is not persistent yet...
	objutils.createonaccess('_objects', dict)

	def __init__(self, path):
		'''
		'''
		self._db = sqlite3.connect(path)
		self._db.execute('create table if not exists tags(tag text, object text)')
		self._db.commit()

	putils.proxymethods((
		'commit',
	), '_db')


	def tag(self, obj, *tags, **opts):
		'''
		'''
		db = self._db
		objs = self._objects.items()
		if (ANY, obj) not in self._objects:
			gid = str(uuid.uuid4())
			self._objects[gid] = obj
		else:
			gid = objs[objs.index((ANY, obj))][0]
		for tag in tags:
			# check if such a tag exists...
			if len(db.execute('select * from tags where tag=? and object=?', (tag, gid)).fetchall()) > 0:
				continue
			db.execute('insert into tags values (?, ?)', (tag, gid))
		if not opts.get('NOCOMMIT', False):
			db.commit()
	##!!!
##	def untag(self, obj, *tags, **opts):
##		'''
##		'''
##		##!!!
##		if not opts.get('NOCOMMIT', False):
##			db.commit()

	def any(self, *tags, **opts):
		'''
		'''
		db = self._db
		objs = self._objects
		# build the query...
		query = ' or '.join(['tag=?']*len(tags))
		gids = db.execute('select distinct object from tags where ' + query, tags).fetchall()
		if opts.get('RETURN_GIDS', False):
			return gids
		return set([ objs[gid[0]] for gid in gids ])
	# XXX rethink -- this makes one .any(...) request per tag which is
	# 	  bad if we have allot of tags...
	def all(self, *tags, **opts):
		'''
		'''
		db = self._db
		objs = self._objects
		##!!! this is not good, need to make a direct SQL select version of this...
		res = self.any(tags[0])
		for tag in tags[1:]:
			res.intersection_update(self.any(tag))
		return res
	# XXX need to think more about this -- try to make it one request...
	def none(self, *tags, **opts):
		'''
		'''
		db = self._db
		objs = self._objects
		fail = [ e[0] for e in self.any(RETURN_GIDS=True, *tags) ]
		# build the query...
		query = ' and '.join(['(not object=?)']*len(fail))
		gids = db.execute('select distinct object from tags where ' + query, fail).fetchall()
		if opts.get('RETURN_GIDS', False):
			return gids
		return set([ objs[gid[0]] for gid in gids ])


	def tags(self, *objs):
		'''
		'''
		db = self._db
		objects = self._objects.items()
		# build the query...
		if len(objs) > 0:
			query = ' or '.join(['object=?']*len(objs))
			objs = [ objects[objects.index((ANY, o))][0] for o in objs ]
			tags = db.execute('select distinct tag from tags where ' + query, objs).fetchall()
		else:
			tags = db.execute('select distinct tag from tags').fetchall()
		return [ t[0] for t in tags ]
	def objects(self, **opts):
		'''
		'''
		db = self._db
		# build the query...
		gids = db.execute('select distinct object from tags').fetchall()
		if opts.get('RETURN_GIDS', False):
			return gids
		objs = self._objects
		return set([ objs[gid[0]] for gid in gids ])

		



#-----------------------------------------------------------------------
if __name__ == '__main__':

	from pprint import pprint
	import os

	TEST_DB = os.path.join('test', 'sqlitetags.db')

	if os.path.isfile(TEST_DB):
		os.remove(TEST_DB)

	ts = SQLiteTagset(TEST_DB)

	for i in xrange(1000):
		ts.tag(i, *str(i), NOCOMMIT=True)
	ts.commit()

	# any number that has either 1 or 9 digits
##	pprint(ts.any(*'19'))
	# any number that has only 1 and 9 digits
	pprint(ts.all(*'1234'))
	# any number not containing any of 012345678 digits
	pprint(ts.none(*'012345678'))

	pprint(ts.tags())
	pprint(ts.tags(123))

	pprint(ts.objects())

	


#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
