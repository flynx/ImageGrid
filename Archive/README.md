# Photo archive template directory

The contents of this are copied to each archive drive root.

```shell
$ cp -R ./media PATH_TO_ARCHIVE_DRIVE
```

The scripts are stored with the archive for generational compatibility,
both building and documenting the structure the archive was created with.


## Scripts

```
media
├── img
│   └── my
│       └── work
│           ├── sync-flash.sh
│           ├── process-archive.sh
│           ├── compress-archive.sh
│           └── update-exif.sh
└── tree.sh
```

### `sync-archive.sh`

Ingest media into the archive and prepare it for further steps in the 
workflow

This script can be run interactively:
```shell
$ ./sync-archive.sh
```

This will:
- Create the necessary directory structure
  (see: [Archive directory structure](#arcive-direcotry-structure))
- Copy and verify the contents of 1 or more external media
  to the archive directory
- Prepare the archive for further work via `process-archive.sh`
- Compress the archive via `compress-archive.sh`


### `process-archive.sh`

```shell
$ ./process-archive.sh [FLAGS] PATH
```


### `compress-archive.sh`

```shell
$ ./compress-archive.sh [FLAGS] PATH
```


### `update-exif.sh`

```shell
$ ./update-exif.sh [FLAGS] PATH
```


### `tree.sh`



## Archive directory structure


```
media
├── img
│   ├── my
│   │   └── work
│   │       ├── - 20240310 - shoot directory (multi flash card)
│   │       │   ├── 20240310.001
│   │       │   │   ├── ...
│   │       │   │   └── preview (RAW)
│   │       │   ├── 20240310.002
│   │       │   │   ├── ...
│   │       │   │   └── preview (RAW)
│   │       │   ├── ...
│   │       │   └── preview (RAW)
│   │       ├── - 20240310.001 - shoot directory (single flash card)
│   │       │   ├── ...
│   │       │   └── preview (RAW)
│   │       ├── 20240310 - shoot directory (fully sorted)
│   │       │   └── ...
│   │       ├── ...
│   │       ├── sync-flash.sh
│   │       ├── process-archive.sh
│   │       ├── compress-archive.sh
│   │       └── update-exif.sh
│   └── others
│       └── ...
├── video
│   └── ...
├── ...
└── tree.sh
```
