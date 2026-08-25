import { readFile } from "fs/promises";
import axios from "axios";
import { writeLog } from "../db_operation/create_logs.js";

const SOURCE = "getWeatherForecast";
const FORECAST_URL = "https://www.jma.go.jp/bosai/forecast/data/forecast";
const CODE_LIST_PATH = new URL("./code_list.csv", import.meta.url);

/**
 * 配列から要素をランダムに1件選択する。
 *
 * @param {Array<unknown>} values
 * @returns {unknown}
 */
function selectRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

/**
 * 気象庁の地域コード一覧を読み込む。
 *
 * @returns {Promise<string[]>}
 */
async function readLocationCodes() {
  const csv = await readFile(CODE_LIST_PATH, "utf8");
  const locationCodes = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.split(",")[0].trim())
    .filter((code) => /^\d{5,6}$/.test(code));

  if (locationCodes.length === 0) {
    throw new Error("code_list.csvに有効な地域コードがありません");
  }

  return locationCodes;
}

/**
 * 気象庁からランダムな地域の今日の天気予報を取得する。
 *
 * @returns {Promise<string>} 天気予報を表す文章
 * @throws {Error} 地域コード、APIレスポンス、予報データが不正な場合
 */
export async function getWeatherForecast() {
  let locationCode = null;

  try {
    const locationCodes = await readLocationCodes();
    locationCode = selectRandom(locationCodes);
    const url = `${FORECAST_URL}/${locationCode}.json`;

    await writeLog(
      "info",
      SOURCE,
      `地域コード${locationCode}の天気予報を取得します`,
      null,
      null,
    );

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "app-afm weather forecast client",
      },
      timeout: 10000,
    });

    const forecast = Array.isArray(response.data) ? response.data[0] : null;
    const publishingOffice = forecast?.publishingOffice;
    const areas = forecast?.timeSeries?.[0]?.areas;

    if (!publishingOffice || !Array.isArray(areas) || areas.length === 0) {
      throw new Error("気象庁から取得したJSONに必要な予報データがありません");
    }

    const weatherAreas = areas.filter(
      (area) =>
        typeof area?.area?.name === "string" &&
        Array.isArray(area?.weathers) &&
        typeof area.weathers[0] === "string",
    );

    if (weatherAreas.length === 0) {
      throw new Error("今日の天気を取得できる地域がありません");
    }

    const selectedArea = selectRandom(weatherAreas);
    const areaName = selectedArea.area.name;
    let weather = selectedArea.weathers[0];

    // 投稿文面を整形する。
    let custum_area_name = publishingOffice.replace("管区気象台", "");
    custum_area_name = custum_area_name.replace("地方気象台", "");

    //weather = weather.replace(/夜|夕方|　/g, '$&、');
    weather = weather.replaceAll(/(後)\u3000/g, "のち");
    weather = weather.replaceAll(
      /(頃|所により|のはじめ頃|で|夜遅く|昼過ぎ|から|時々|昼前|伴い|激しく)\u3000/g,
      "$1",
    );
    weather = weather.replaceAll(/夜　|朝晩　|夕方　/g, "$&は");
    weather = weather.replaceAll("　", "、");

    // 天気に応じた注意喚起の文章を追加する。
    let end_text = "";
    if (weather.includes("雨")) {
      const list = [
        "雨が降るかもだし、傘を持っていった方が良いかもですよ＞＜",
        "今日のお洗濯は部屋の中の方が良いかもしれないですね！",
        "わ！雨予報です。。お出かけするのに心配だなぁ",
        "雨予報だけど、これは降らない方に賭けます！",
        "雨って素敵な気分になるので好きなんですよね……！",
      ];
      end_text = selectRandom(list);
    } else if (weather.includes("雪")) {
      const list = [
        "雪予報ですよ～！暖かくして過ごさなきゃ",
        "雪やコンコン♪あられやコンコン♪　わわ！聞いてましたか……？",
        "わ！雪予報です。。出歩く時はペンギン歩きですね！",
        "雪予報だけど、「実は大したことない」に賭けます！",
        "雪ってしんしんとした気分になるので好き！",
      ];
      end_text = selectRandom(list);
    } else if (weather.includes("曇")) {
      const list = [
        "曇はどんより気分です……",
        "雲の奥には青空があるかも。なんてねえへへ～",
      ];
      end_text = selectRandom(list);
    } else {
      const list = [
        "今日は絶好のお出かけ日和です～！",
        "晴れた空って気分も晴れやかになりますよね",
        "今日はたくさんお洗濯できそうで嬉しい！",
        "お布団を干して、おひさまの香りを嗅ぎたい気分です♪",
      ];
      end_text = selectRandom(list);
    }

    const message = `気象庁によると、今日の${custum_area_name}は、${weather}になるようです。\n\n${end_text}`;

    await writeLog("info", SOURCE, `天気予報を取得しました: ${message}`, null, {
      locationCode,
      areaName,
    });

    return message;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await writeLog(
      "error",
      SOURCE,
      `天気予報の取得に失敗しました: ${errorMessage}`,
      null,
      { locationCode, stack: error instanceof Error ? error.stack : null },
    );

    throw error;
  }
}
