import HTTPErrorResponse from "../../Types/API/HTTPErrorResponse";
import HTTPMethod from "../../Types/API/HTTPMethod";
import HTTPResponse from "../../Types/API/HTTPResponse";
import Headers from "../../Types/API/Headers";
import Hostname from "../../Types/API/Hostname";
import Protocol from "../../Types/API/Protocol";
import Route from "../../Types/API/Route";
import URL from "../../Types/API/URL";
import Dictionary from "../../Types/Dictionary";
import APIException from "../../Types/Exception/ApiException";
import GenericObject from "../../Types/GenericObject";
import { JSONObject } from "../../Types/JSON";
import API from "../../Utils/API";
import { expect, jest } from "@jest/globals";
import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosStatic,
  Method,
} from "axios";

const DEFAULT_HEADERS: Headers = {
  "Access-Control-Allow-Origin": "*",
  Accept: "application/json",
  "Content-Type": "application/json;charset=UTF-8",
};

jest.mock("axios", () => {
  // Use actual axios module exported functions/constants such as axios.isAxiosError()
  return Object.assign(jest.fn(), jest.requireActual("axios"));
});

// Mock axios(config) top level function
// Ignore type error
// Property 'lastCall' is optional in type MockFunctionState but required in type MockContext
// @ts-ignore
const mockedAxios: jest.MockedFunctionDeep<typeof axios> =
  jest.mocked<AxiosStatic>(axios);

// Spy on calls to HTTPErrorResponse
jest.mock("../../Types/API/HTTPErrorResponse");

const HTTPErrorResponseMock: jest.MockedClass<typeof HTTPErrorResponse> =
  HTTPErrorResponse as jest.MockedClass<typeof HTTPErrorResponse>;

/**
 * Create a fake axios response
 */
function createAxiosResponse<T = any, D = any>(
  {
    data = [] as T,
    status = 200,
    statusText = "OK",
    config = {
      headers: DEFAULT_HEADERS as AxiosHeaders,
    },
    headers = DEFAULT_HEADERS,
  }: Partial<AxiosResponse<T, D>> = {
    data: [] as T,
    status: 200,
    statusText: "OK",
    config: {
      headers: DEFAULT_HEADERS as AxiosHeaders,
    },
    headers: DEFAULT_HEADERS,
  },
): AxiosResponse<T, D> {
  return {
    data,
    status,
    statusText,
    config,
    headers,
  };
}

const mergedHeaders: Headers = {
  "Access-Control-Allow-Origin": "*",
  Accept: "application/json",
  "Content-Type": "application/json", // replace default header
  "X-PoweredBy": "coffee", // add new header
};

/**
 * Create a fake axios error
 */
function createAxiosError<T = any, D = any>(
  {
    config = {
      headers: DEFAULT_HEADERS as AxiosHeaders,
    },
    isAxiosError = true,
    toJSON = () => {
      return {};
    },
    name = "SOME_ERROR_OCCURRED",
    message = "Something went wrong",
    response = createAxiosResponse(),
  }: Partial<AxiosError<T, D>> = {
    config: {
      headers: DEFAULT_HEADERS as AxiosHeaders,
    },
    isAxiosError: true,
    toJSON: () => {
      return {};
    },
    name: "",
    message: "",
    response: createAxiosResponse(),
  },
): AxiosError {
  return {
    config,
    isAxiosError,
    toJSON,
    name,
    message,
    response,
  };
}

/**
 * Create fake axios parameters
 */
function createAxiosParameters(
  {
    method = "GET",
    url = "https://catfact.ninja/fact",
    headers = { ...mergedHeaders },
    data = undefined,
  }: {
    method?: Method;
    url?: string;
    headers?: Dictionary<string>;
    data?: any;
  } = {
    method: "GET",
    url: "https://catfact.ninja/fact",
    headers: { ...mergedHeaders },
  },
): AxiosRequestConfig {
  return {
    method,
    url,
    headers,
    data,
  };
}

const responseData: JSONObject = {
  fact: "Cats have 3 eyelids.",
  length: 20,
};

const requestData: any = {
  breed: "Siamese",
};

const requestHeaders: Headers = {
  "Content-Type": "application/json",
  "X-PoweredBy": "coffee",
};

afterAll(() => {
  jest.restoreAllMocks();
});

describe("API", () => {
  test("should create an instance", () => {
    const protocol: string = "https://";
    const hostname: string = "catfact.ninja";
    const api: API = new API(Protocol.HTTPS, new Hostname(hostname));

    expect(api).toBeInstanceOf(API);
    expect(api.baseRoute.toString()).toBe("/");
    expect(api.protocol).toBe(protocol);
    expect(api.hostname.toString()).toBe(hostname);
  });

  test("should create an instance with base route", () => {
    const protocol: string = "https://";
    const hostname: string = "catfact.ninja";
    const route: string = "fact";

    const api: API = new API(
      Protocol.HTTPS,
      new Hostname(hostname),
      new Route(route),
    );

    expect(api).toBeInstanceOf(API);
    expect(api.baseRoute.toString()).toBe("fact");
    expect(api.protocol).toBe(protocol);
    expect(api.hostname.toString()).toBe(hostname);
  });
});

describe("getErrorResponse", () => {
  test("should create an HTTPErrorResponse instance", () => {
    const data: any = { message: "Something went wrong" };
    const status: number = 500;
    const headers: Headers = { "X-PoweredBy": "coffee" };

    const response: AxiosResponse<typeof data, GenericObject> =
      createAxiosResponse({
        data,
        headers,
        status,
      });
    const axiosError: AxiosError<typeof data, GenericObject> = createAxiosError(
      {
        response,
      },
    );

    // Use bracket notation property access to access private method
    const errorResponse: HTTPErrorResponse =
      API["getErrorResponse"](axiosError);

    expect(errorResponse).toBeInstanceOf(HTTPErrorResponse);
    expect(HTTPErrorResponseMock).toHaveBeenCalledTimes(1);
    expect(HTTPErrorResponseMock).toHaveBeenCalledWith(status, data, headers);
  });

  test("should throw if response error has no response", () => {
    // NOTE: Passing undefined will initialize the default parameter
    const axiosError: AxiosError<null, GenericObject> = createAxiosError({
      response: null!,
    }) as AxiosError<null, GenericObject>;

    // Use bracket notation property access to access private method
    expect(() => {
      API["getErrorResponse"](axiosError);
    }).toThrowError(APIException);
  });
});

describe("fetch", () => {
  test("should return an HTTPResponse if request is successful", async () => {
    const status: number = 200;
    const params: Dictionary<string> = {
      count: "1",
    };

    const mockedParsedResponse: HTTPResponse<typeof responseData> =
      new HTTPResponse(status, responseData, DEFAULT_HEADERS);

    const mockedAxiosResponse: AxiosResponse<
      typeof responseData,
      GenericObject
    > = createAxiosResponse({
      status,
      data: responseData,
    });

    mockedAxios.mockResolvedValueOnce(mockedAxiosResponse);

    const response: HTTPResponse<typeof responseData> = await API.fetch({
      method: HTTPMethod.POST,
      url: new URL(Protocol.HTTPS, "catfact.ninja", new Route("fact")),
      data: requestData,
      headers: requestHeaders,
      params,
    });

    // Check method, url (protocol, hostname, parameters), headers, request data
    expect(axios).toBeCalledWith({
      method: "POST",
      url: "https://catfact.ninja/fact?count=1",
      headers: mergedHeaders,
      data: requestData,
    });

    expect(response).toEqual(mockedParsedResponse);
  });

  test("should return an HTTPErrorResponse if request fails", async () => {
    const status: number = 404;
    const statusText: string = "Not Found";
    const data: JSONObject = {
      message: "Not Found",
    };

    const mockedAxiosError: AxiosError<undefined, GenericObject> =
      createAxiosError({
        response: createAxiosResponse({
          status,
          statusText,
          data,
        }),
        message: "An error occurred",
      }) as AxiosError<undefined, GenericObject>;

    mockedAxios.mockRejectedValueOnce(mockedAxiosError);

    const httpErrorResponse: HTTPResponse<JSONObject> = await API.fetch({
      method: HTTPMethod.GET,
      url: new URL(Protocol.HTTPS, "catfact.ninja", new Route("fact")),
    });

    expect(axios).toBeCalledWith({
      method: "GET",
      url: "https://catfact.ninja/fact",
      headers: DEFAULT_HEADERS,
      data: undefined,
    });

    expect(httpErrorResponse).toBeInstanceOf(HTTPErrorResponse);
  });

  test("should throw an APIException if initializing request fails", async () => {
    mockedAxios.mockImplementationOnce(() => {
      throw new Error("Something went wrong");
    });

    await expect(async () => {
      await API.fetch({
        method: HTTPMethod.GET,
        url: new URL(Protocol.HTTPS, "catfact.ninja", new Route("fact")),
      });
    }).rejects.toThrowError(APIException);
  });
});

describe("getDefaultHeaders", () => {
  test("should return default headers", () => {
    expect(API.getDefaultHeaders()).toEqual(DEFAULT_HEADERS);
  });
});

describe("getHeaders", () => {
  test("should merge headers", () => {
    // Use bracket notation to access protected member
    expect(API["getHeaders"](requestHeaders)).toEqual(mergedHeaders);
  });
});

interface HTTPMethodType {
  name: Lowercase<HTTPMethod>; // 'get' | 'post' | 'delete' | 'put'
  method: HTTPMethod;
}

// Set up table-driven tests for
// .get(), .post(), .put(), .delete(), get(), post(), put(), delete()
const httpMethodTests: Array<HTTPMethodType> = [
  {
    name: "get",
    method: HTTPMethod.GET,
  },
  {
    name: "post",
    method: HTTPMethod.POST,
  },
  {
    name: "put",
    method: HTTPMethod.PUT,
  },
  {
    name: "delete",
    method: HTTPMethod.DELETE,
  },
  {
    name: "head",
    method: HTTPMethod.HEAD,
  },
];

describe.each(httpMethodTests)("$name", ({ name, method }: HTTPMethodType) => {
  test(`should make a ${method} request`, async () => {
    mockedAxios.mockResolvedValueOnce(createAxiosResponse());

    const url: URL = new URL(
      Protocol.HTTPS,
      "catfact.ninja",
      new Route("fact"),
    );
    const got: HTTPResponse<JSONObject> = await (API as any)[name]({
      url,
      data: requestData,
      headers: requestHeaders,
    });

    // Check method, url, headers, request data
    expect(axios).toBeCalledWith(
      createAxiosParameters({
        method,
        url: "https://catfact.ninja/fact",
        data: requestData,
        headers: mergedHeaders,
      }),
    );
    expect(got).toBeInstanceOf(HTTPResponse);
  });
});

describe.each(httpMethodTests)(".$name", ({ name, method }: HTTPMethodType) => {
  test(`should make a ${method} request`, async () => {
    const route: string = "fact";
    const hostname: string = "catfact.ninja";
    const api: API = new API(Protocol.HTTPS, new Hostname(hostname));

    mockedAxios.mockResolvedValueOnce(createAxiosResponse());

    const url = new URL(api.protocol, api.hostname, api.baseRoute.addRoute(route));
    const got: HTTPResponse<JSONObject> = await (api as any)[name]({
      url,
      data: requestData,
      headers: requestHeaders,
    });

    // Check method, url (protocol, hostname, route), headers, request data
    expect(axios).toBeCalledWith(
      createAxiosParameters({
        url: "https://catfact.ninja/fact",
        method,
        data: requestData,
      }),
    );
    expect(got).toBeInstanceOf(HTTPResponse);
  });
});
