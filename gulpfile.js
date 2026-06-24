import gulp from 'gulp';
const { dest, series, src } = gulp;

import gulpClean from 'gulp-clean';
import gulpYaml from 'gulp-yaml';
import gulpZip from 'gulp-zip';

export function zip() {
	return src('dist/**/*')
		.pipe(gulpZip('genesys.zip'))
		.pipe(dest('.'));
}

export function clean() {
	return src(['public/lang/', 'public/system.json', 'public/template.json', 'public/dice/'], { allowEmpty: true }).pipe(gulpClean());
}

export function data() {
	return src('yaml/**/*.yml').pipe(gulpYaml()).pipe(dest('public/'));
}

export function copyDice() {
	return src('dice/**/*').pipe(dest('public/dice'));
}

function watchDirs() {
	gulp.watch('yaml/**/*.yml', data);
}

export const watch = series(clean, data, copyDice, watchDirs);
export default series(clean, data, copyDice);
