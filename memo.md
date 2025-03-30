docker compose stop python-afm && docker compose rm -f python-afm && docker compose up -d python-afm


docker exec -i python-afm sh -c "unzip /penetration/M_PLUS_Rounded_1c.zip -d /penetration/fonts/"

docker exec -i python-afm sh -c "ls /usr/share/fonts/truetype/"

chmod -R 777 penetration


git add . && git commit -m "
- フォロー取得時にnullが返却されても処理が続行されてしまい、全フォロワーをアンフォローする問題を修正
- 絵文字を取得した時にnullが返却されてもDBに書き込まずエラー処理する
" && git push -u origin development

