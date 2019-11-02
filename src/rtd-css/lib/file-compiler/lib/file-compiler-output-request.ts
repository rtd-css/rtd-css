export interface FileCompilerOutputRequest {
	css: FileCompilerOutputRequest.Css;
	js: FileCompilerOutputRequest.Js;
}

export module FileCompilerOutputRequest {
	export enum Css {
		General = 'General',
		GeneralAndDevices = 'GeneralAndDevices',
	}

	export enum Js {
		General = 'General',
		GeneralAndDevices = 'GeneralAndDevices',
	}
}
