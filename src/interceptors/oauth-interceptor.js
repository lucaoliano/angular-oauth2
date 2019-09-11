
/**
 * OAuth interceptor.
 */

function oauthInterceptor($q, $rootScope, OAuthToken, $injector) {
  return {
    request: function (config) {
      config.headers = config.headers || {};

      // Inject `Authorization` header.
      if (!config.headers.hasOwnProperty('Authorization') && OAuthToken.getAuthorizationHeader()) {
        config.headers.Authorization = OAuthToken.getAuthorizationHeader();
      }

      return config;
    },
    responseError: function (rejection) {
      if (!rejection) {
        return $q.reject(rejection);
      }

      // Catch `invalid_request` and `invalid_grant` errors and ensure that the `token` is removed.
      if (400 === rejection.status && rejection.data && rejection.data.error &&
        ('invalid_request' === rejection.data.error || 'invalid_grant' === rejection.data.error)
      ) {
        OAuthToken.removeToken();

        $rootScope.$emit('oauth:error', rejection);
      }

      // Catch `invalid_token` and `unauthorized` errors.
      // The token isn't removed here so it can be refreshed when the `invalid_token` error occurs.
      if (401 === rejection.status &&
        $injector.get('OAuthToken').getRefreshToken() &&
        ((rejection.data && rejection.data.error && 'invalid_token' === rejection.data.error) ||
        (rejection.headers && rejection.headers('www-authenticate') && 0 === rejection.headers('www-authenticate').indexOf('Bearer')))
      ) {
        let deferred = $q.defer();
        $injector.get('OAuth').getRefreshToken().then(() => {
          let $http = $injector.get('$http');

          delete rejection.config.headers.Authorization;
          $http(rejection.config).then((response) => deferred.resolve(response), (error) => deferred.reject(error));
        }, (error) => {
          deferred.reject(error);
          $rootScope.$emit('oauth:error', error);
        });

        return deferred.promise;
      }

      if (401 === rejection.status) {
        $rootScope.$emit('oauth:error', rejection);
      }

      return $q.reject(rejection);
    }
  };
}

oauthInterceptor.$inject = ['$q', '$rootScope', 'OAuthToken', '$injector'];

/**
 * Export `oauthInterceptor`.
 */

export default oauthInterceptor;
