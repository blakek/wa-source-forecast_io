var simpleRequest = require('./lib/simpleRequest');

// The main object that is visible to other modules
var forecast_io = {
	info: {
		id: 'forecast_io', // What we use to identify this source (required)
		name: 'Forecast.io', // Human-readable name of the source (required)
		enabled: true, // Should this be shown as an option to users (requred for now)
		needs_api_key: true, // Does this package want an API key to work?
		source_site: 'http://forecast.io/', // Website of source for info (optional)
		last_call: undefined // Last time this source was called. Used for caching request results (esp. to keep from using up free API keys)
	},
	getWeatherData: function (location, on_finish) {
		var remainingTime = lastCall + cacheTime - now();

		if (remainingTime > 0) {
			console.info(': using cached results for ' + remainingTime + ' more seconds.');
			on_finish(lastResults);
			return;
		} else {
			lastCall = now();
		}

		simpleRequest(prepareURI(sources.forecast, location), function (data) {
			forecastio2wa(data, on_finish);
		});
	},
	options: options = {
		alertRange: 50,
		testing: true
	}
};

var lastCall = 0,
    cacheTime = 60,
    lastResults = {};

// Our sources and their respective URIs
var sources = {
	forecast: { // URI to get general forecast data
		uri: 'https://api.forecast.io/forecast/${api_key}/${latitude},${longitude}',
		testing_uri: 'file://' + __dirname + '/testing/forecast_io-test.json'
	},
	storms: { // URI to get wide-area storm data (not currently used)
		uri: 'https://api.darkskyapp.com/v1/interesting/${api_key}',
		testing_uri: ''
	}
};

function now() {
	return Math.floor(Date.now() / 1000);
}

// Get a source object URI prepared to call
function prepareURI(source_obj, location) {
	var uri = (options.testing) ? source_obj.testing_uri : source_obj.uri;

	console.log(options);

	return uri.replace(/\$\{latitude\}/g, location.latitude)
	          .replace(/\$\{longitude\}/g, location.longitude);
}

function forecastio2wa(result_string, cb) {
	var result_object = JSON.parse(result_string);

	lastResults = {
		last_updated: now(),
		location: {
			latitude: result_object.latitude,
			longitude: result_object.longitude
		},
		nearest_storm: {
			bearing: result_object.currently.nearestStormBearing || 0,
			distance: result_object.currently.nearestStormDistance || 0
		},
		now: {
			temp: Math.round(result_object.currently.temperature),
			temp_apparent: Math.round(result_object.currently.apparentTemperature),
			conditions: result_object.currently.summary,
			icon: forecast_io2waIcon(result_object.currently.icon),
			precipitation: {
				intensity: result_object.currently.precipIntensity,
				probability: Math.round(result_object.currently.precipProbability * 100),
				type: result_object.currently.precipType
			},
			wind: {
				speed: Math.round(result_object.currently.windSpeed),
				bearing: result_object.currently.windBearing
			}
		},
		today: {
			temp: {
				high: Math.round(result_object.daily.data[0].temperatureMax),
				low: Math.round(result_object.daily.data[0].temperatureMin)
			},
			sun: {
				rise_time: result_object.daily.data[0].sunriseTime,
				set_time: result_object.daily.data[0].sunsetTime
			},
			summary: result_object.hourly.summary,
			icon: forecast_io2waIcon(result_object.hourly.icon),
			hourly: function () { // will contain precipitation, temp, and other hourly data
				var r = [];

				result_object.hourly.data.forEach(function (hour_data) {
					r.push({
						temp: Math.round(hour_data.temperature),
						precipitation: {
							intensity: hour_data.precipIntensity,
							probability: Math.round(hour_data.precipProbability * 100),
							type: hour_data.precipType
						},
						sun: {
							rise_time: hour_data.sunriseTime,
							set_time: hour_data.sunsetTime
						},
						wind: {
							bearing: hour_data.windBearing,
							speed: Math.round(hour_data.windSpeed)
						},
						summary: hour_data.summary,
						icon: forecast_io2waIcon(hour_data.icon),
						time: hour_data.time
					});
				});
				return r;
			}
		},
		week: {
			daily: function() {
				var r = [];

				result_object.daily.data.forEach(function (day_data) {
					r.push({
						temp: {
							high: Math.round(day_data.temperatureMax),
							low: Math.round(day_data.temperatureMin)
						},
						precipitation: {
							intensity: day_data.precipIntensity,
							probability: Math.round(day_data.precipProbability * 100),
							type: day_data.precipType
						},
						sun: {
							rise_time: day_data.sunriseTime,
							set_time: day_data.sunsetTime
						},
						wind: {
							bearing: day_data.windBearing,
							speed: Math.round(day_data.windSpeed)
						},
						summary: day_data.summary,
						icon: forecast_io2waIcon(day_data.icon),
						time: day_data.time
					});
				});
				return r;
			}
		},
		alerts: result_object.alerts,
		alert_count: (result_object.alerts) ? (result_object.alerts.length) : 0,
		units: {
			temp: 'F',
			distance: 'mi',
			speed: 'mph'
		}
	};

	cb(lastResults);
}

function forecast_io2waIcon(origText) {
	switch (origText) {
		case 'partly-cloudy-day':
			return 'day-cloudy';
		case 'partly-cloudy-night':
			return 'night-alt-cloudy';
		case 'cloudy':
			return 'cloudy';
		case 'wind':
			return 'strong-wind';
		case 'sleet':
			return 'rain-mix';
		case 'snow':
			return 'snow';
		case 'rain':
			return 'rain';
		case 'clear-night':
			return 'night-clear';
		case 'clear-day':
			return 'day-sunny';
		default:
			return origText;
	}
}

module.exports = forecast_io;
