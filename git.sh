#!/bin/sh

BRANCH=$(git branch --show-current)

echo "現在のブランチ: $BRANCH"
echo "コミットメッセージを入力してください:"
read COMMIT_MESSAGE

echo ""
echo "以下の内容で実行します:"
echo "--------------------------------"
echo "git add ."
echo "git commit -m \"$COMMIT_MESSAGE\""
echo "git push -u origin $BRANCH"
echo "--------------------------------"
echo ""

printf "本当に送信しますか？ [y/N]: "
read CONFIRM

case "$CONFIRM" in
  y|Y|yes|YES)
    git add . &&
    git commit -m "$COMMIT_MESSAGE" &&
    git push -u origin "$BRANCH"
    ;;
  *)
    echo "キャンセルしました。"
    ;;
esac