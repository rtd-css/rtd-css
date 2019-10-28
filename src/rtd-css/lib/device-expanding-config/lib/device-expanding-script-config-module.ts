import { DeviceType } from '../../device-type';

export module DeviceExpandingScriptConfigModule {
	export interface Config {
		breakpointsForDeviceByDevice: BreakpointsForDeviceByDevice;
	}

	export class Device {
		type: DeviceType;
		name: string;
		cssClass: string;

		constructor(type: DeviceType, name: string, cssClass: string) {
			this.type = type;
			this.name = name;
			this.cssClass = cssClass;
		}
	}

	export class Breakpoint {
		device: Device;
		maxWidth: number;

		constructor(device: Device, maxWidth: number) {
			this.device = device;
			this.maxWidth = maxWidth;
		}
	}

	export class BreakpointsForDevice {
		device: Device;
		breakpoints: Breakpoint[];

		constructor(device: Device, breakpoints: Breakpoint[]) {
			this.device = device;
			this.breakpoints = breakpoints;
		}
	}

	export interface BreakpointsForDeviceByDevice {
		[deviceType: string]: BreakpointsForDevice;
	}
}
