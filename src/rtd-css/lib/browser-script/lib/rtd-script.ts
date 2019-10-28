export const rtdScript = `(function () {

	var breakpointsForDevice = '{breakpointsForDevice}';

	var config = '{config}';

	var DeviceType = {
		Unknown: 'Unknown',
		Mobile: 'Mobile',
		Tablet: 'Tablet',
		Desktop: 'Desktop',
	};

	var desktopOsList = [
		'Windows',
		'Mac OS',
		'CentOS',
		'Fedora',
		'FreeBSD',
		'Debian',
		'GNU',
		'Linux',
		'OpenBSD',
		'PCLinuxOS',
		'RedHat',
		'Solaris',
		'SUSE',
		'Ubuntu',
		'Unix',
		'VectorLinux',
	];

	var lastBreakpoint;

	function getBreakpoint(breakpoints, winWidth) {
		var result,
			i, len,
			curBreakpoint;

		len = breakpoints.length;
		for (i = 0; i < len; i++) {
			curBreakpoint = breakpoints[i];

			if (i === len - 1 || winWidth <= curBreakpoint.maxWidth) {
				result = curBreakpoint;
				break;
			}
		}

		return result;
	}

	function addClassToElement(element, classToAdd) {
		var newClassName = element.className || '';
		if (newClassName) {
			newClassName += ' ';
		}
		newClassName += classToAdd;

		element.className = newClassName;
	}

	function removeClassFromElement(element, classToRemove) {
		if (element.className) {
			element.className = element.className.replace(
				new RegExp('(?:^|\\s)' + classToRemove + (?!\\S)', 'g'),
				'',
			);
		}
	}

	function startRtdForBreakpoints(breakpointsForDevice) {
		setInterval(
			function () {
				var win = window,
					doc = document,
					docElem = doc.documentElement,
					body = doc.getElementsByTagName('body')[0],
					winWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
					breakpoint = getBreakpoint(breakpointsForDevice.breakpoints, winWidth);

				if (breakpoint !== lastBreakpoint) {
					if (lastBreakpoint) {
						removeClassFromElement(document.documentElement, lastBreakpoint.device.cssClass);
					}

					addClassToElement(document.documentElement, breakpoint.device.cssClass);
				}
			},
			20,
		);
	}

	function startRtdForConfig(config) {
		var uaParser = new UAParser(),
			uaData = uaParser.getResult(),
			breakpointsForDevice;

		switch (uaData.device.model) {

			case 'mobile':
				breakpointsForDevice = config.breakpointsByDevice[DeviceType.Mobile];
				break;

			case 'tablet':
				breakpointsForDevice = config.breakpointsByDevice[DeviceType.Tablet];
				break;

			default:
				if (desktopOsList.indexOf(uaData.os.name) > -1) {
					breakpointsForDevice = config.breakpointsByDevice[DeviceType.Desktop];
				} else {
					breakpointsForDevice = config.breakpointsByDevice[DeviceType.Unknown];
				}

		}

		startRtdForBreakpoints(breakpointsForDevice);
	}

	function init() {
		if (breakpointsForDevice) {
			startRtdForBreakpoints(breakpointsForDevice);
		} else {
			startRtdForConfig(config);
		}
	}

	init();

})()`;
