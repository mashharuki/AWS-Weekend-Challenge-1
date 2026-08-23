[Weekend Challenge: Set your creative app free!](https://builder.aws.com/content/3HkL1H9G5DVm7ZtpO8EcOt6jZsV/weekend-challenge-set-your-creative-app-free)のクエストに参加したいと考えています！！

時間がない中大変恐縮ですが、あなたには参加要件を満たす最高のアウトプットの実装計画をたててください。

よろしくお願いします！

## 解決したい課題
- AWS Community Builderの活動をサポートする記事やアプリのアイディアを毎日情報収集してポストしてくれるアプリ！

## アプローチ
- 毎日決められた時間に情報収集＆内容精査＆世の中のトレンド調査&内容整形してくれる
	- UIはマークダウン記法にて
- AIAgentを定期実行する
	- ステートマシンでワークフロー化する
- ブログ的な内容でUIには描画する
- 言語は英語で！

## 技術スタック
- pnpm
- monorepo
- biome
- knip
- jscpd
- hono
- strands agent
- Amazon Bedrock
	- モデルにはAWSクレジットが適用できるnova モデルを採用する
- AWS CDK
- cdk-nag
- react
- vite
- typescript
- Event Bridge (定期実行)
- Step Functions (情報収集＆内容精査＆世の中のトレンド調査&内容整形)
	- 整形した内容はマークダウン記法似て保存する
- trivy
- secret manager
- Lambda
- aws-lambda (honoが標準で提供しているミドルウェア)
- API Gateway
- DynamoDB

## 要件
- 時間がないため、必要最低限に絞って開発をお願いします。
- CDKデストロイで全てのリソースがデストロイされるようにしてください(sercet managerやlogグループも含む)！
- CDKのベストプラクティスに従い、各サービスのオプションや論理IDは外部ファイルで管理するようにしてください！
- アプリに加えてコンテストの要件を満たすブログ記事(AWS Builder Center投稿向け)のマークダウンの執筆も実装計画に加えること
- READMEにはアプリの概要、システムアーキテクチャ(AWS アイコンを使ったdrawioで作ったシステムアーキテクチャ)、丁寧な動かし方(セットアップ、ビルド、CDKによるリソースのデプロイ、デストロイ方法)を必ず加えること！

## Weekend Challenge: Set your creative app free!の概要

Welcome to the Set Your Creative App Free Weekend Challenge (Level 200)
This is your chance to build something useful, learn new AWS skills, and earn an awesome prize, all in one weekend. This is a Level 200 challenge. Push into more advanced territory and show what you can do. The first 101 qualifying submissions earn an AWS Builder Jacket. No random drawing. If you complete the challenge and are one of the first 101 to submit, you win. Let's go!
Terms apply
What You'll Build 🏗️
Last week was about a creative app. This week, you'll turn your creative app into an always-on agent that makes something new on its own and has it ready when you return. The best tool is the one you never have to open. Here are some ideas to spark your creativity:
• A daily-art or daily-poem agent
• An agent that themes its output to the day or weather
• An agent that remixes community prompts
• An agent that improves its style over time
Deploy using AWS Free Tier services. For new accounts, access up to $200 in Free Tier credits covering Amazon Bedrock, Nova models, Lambda, and more.
Win an AWS Builder Jacket 🏆
The first 101 qualifying submissions will each receive an AWS Builder Jacket (approx. $99 value). There is no lottery and no voting on the jacket. Be one of the first 101 to submit a qualifying entry and the jacket is yours.

AWS Builder Jacket
Builder of the week 🌟
We'll spotlight standout community builds in next week's article, so share yours in the comments and cheer on the builds you love.
How to Participate 🎯
Build your project, deployed on at least one AWS service.
Publish an article on AWS Builder Center that meets the requirements below between August 21, 12:00 AM PT and August 24, 2026 at 1:00 PM PT.
Article Requirements ✍️ (min. 500 words)
• Title must include: ""Weekend Creative Agent Challenge: [Name of Your Project]""
• Add the tag: #agents
• Vision and what it does (the problem it solves and how it works)
• How you built it (process, key decisions, challenges)
• AWS services used and a brief architecture overview
• What you learned
• A link to your app or repo
Timeline ⏰
• Opens: August 21, 12:00 AM PT
• Deadline: August 24, 2026 at 1:00 PM PT
• Evaluation complete within 2 weeks of the deadline
• Winners notified by email and an updated Builder Center article

Weekend Challenge: Set Your Creative App Free
Terms and Conditions
Effective August 21, 2026
DESCRIPTION OF CHALLENGE
During the AWS Builder Center Weekend Challenge: Set Your Creative App Free (the "Challenge"), be one of the first 101 participants to submit a qualifying entry to the applicable Amazon Web Services ("AWS") Builder Center challenge and complete the requirements described below for a chance to win an AWS Builder Jacket. NO PURCHASE NECESSARY. VOID WHERE PROHIBITED. Terms and conditions apply.
Challenge Prompt: Turn your creative app into an always-on agent that makes something new on its own and has it ready when you return. The best tool is the one you never have to open. Ideas include a daily-art or daily-poem agent, an agent that themes its output to the day or weather, an agent that remixes community prompts, or an agent that improves its style over time. Deploy using AWS Free Tier services. For new AWS accounts: access up to $200 in Free Tier credits, enough to cover Amazon Bedrock, Nova models, Lambda, and more.
Challenge Period: Publish your Builder Center article between August 21, 2026 at 12:00 AM PT through August 24, 2026 at 1:00 PM PT.
CHALLENGE TERMS AND CONDITIONS
By participating in the Challenge, you agree to be bound by these Terms and Conditions and the AWS Builder Terms (available at builder.aws.com/terms). NO PURCHASE NECESSARY. VOID WHERE PROHIBITED.
During the Challenge Period, be one of the first 101 participants to submit a qualifying entry and complete the requirements described below for a chance to win an AWS Builder Jacket (approximate retail value $99 USD). Participation in the Challenge will require you to (1) have a builder.aws.com profile and (2) publish an article on AWS Builder Center describing your solution.
To the extent that a participant uses an AWS account under the AWS Free Tier, the AWS Free Tier Terms (available at https://aws.amazon.com/free/terms/ ) will apply. For the avoidance of doubt, you acknowledge that participants registering for the AWS Free Tier may be required to provide credit card information in order to complete their AWS account; however, such accounts will not convert to a billable AWS account, and AWS will not otherwise charge your credit card for any payments relating to your AWS account, without your consent.
Eligibility
Must be at least 18 years of age and have a builder.aws.com profile to be eligible for participation in the Challenge. Excludes individuals living in Argentina, Australia, Brazil, Hong Kong, Indonesia, Italy, Malaysia, Philippines, Poland, Russia, Singapore, Spain, Thailand, Vietnam, Cuba, Iran, Syria, North Korea, the United Arab Emirates, Belarus, the so-called Donetsk People's Republic region (DNR), the so-called Luhansk People's Republic region (LNR) and the region of Crimea. AWS, Amazon, employees of AWS, employees of Amazon, and their immediate family members and members of their households are not eligible to participate. Limit one entry per person.
SUBMISSION REQUIREMENTS
To enter, participants must complete the following steps before the end of the Challenge Period (August 24, 2026 at 1:00 PM PT):
Publish an article on AWS Builder Center that meets the Article Requirements below.
Include a link to your deployed application that meets the Application Requirements below or a public GitHub repository containing your source code.
Application Requirements
Your application must meet all of the following requirements. Entries that do not meet these requirements may be disqualified in AWS's sole discretion.
The application must be an always-on agent that autonomously makes something creative (words, images, sound, or other output) as described in the challenge prompt (e.g., a daily-art or daily-poem agent, an agent that themes its output to the day or weather, an agent that remixes community prompts, or an agent that improves its style over time).
The application must demonstrate autonomous, scheduled, or event-driven functionality — producing creative output without manual user initiation — including evidence of creative output being generated.
The application must be deployed using at least one AWS service (AWS Free Tier services are encouraged).
Article Requirements
Your article must be published between the challenge period of August 21, 2026 at 12:00 AM PT through August 24, 2026 at 1:00 PM PT. Your article must be a minimum of 500 words and must address each of the following sections:
Article Title: Your article must have "Weekend Creative Agent Challenge: [Name of Your Project]" in the title.
Article Tag: Add the tag, "agents" to your article.
Vision & What It Does. Describe the purpose of your agent and the creative output it produces, including the problem it solves and how it works.
How You Built It. Describe your development process, including key decisions, challenges encountered, and how you overcame them.
AWS Services Used / Architecture Overview. List the AWS services used and provide a brief overview of your application architecture. Diagrams are encouraged but not required.
What You Learned. Reflect on what you learned during the challenge, including any new skills, services, or approaches you discovered.
Link to App or Repo. Provide a working link to your deployed application OR a link to a public GitHub repository containing your source code. Private or inaccessible repositories/links at the time of evaluation will result in disqualification.
EVALUATION PROCESS & JUDGING CRITERIA
Within two (2) weeks of the Challenge Period end date, AWS will evaluate all eligible Submissions. Submissions will be evaluated by a combination of AI tools and subject matter experts.
Evaluation Standard: Each submission is evaluated on a Pass/Fail basis. A submission must achieve Pass in all of the following categories to be eligible for a prize:
Category 1: Completeness (Pass/Fail Gate). Did the participant deliver everything the challenge asked for? The article must be at least 500 words and must address all required sections listed under Article Requirements. The link to the app that meets the Application Requirements or repository must be functional and accessible. A Fail in Completeness disqualifies the submission from further evaluation.
Category 2: Relevance & Functionality. Does the submission meet the challenge prompt and Application Requirements? The application must be an always-on agent that autonomously produces creative output as described in the challenge prompt and Application Requirements. It must demonstrate autonomous or scheduled functionality (via screenshots, video, logs, or a live deployment link), including evidence of creative output being generated without manual initiation.
Category 3: AWS Service Usage. Does the solution use AWS services? The application must be deployed using at least one AWS service. The article must clearly describe which AWS services were used.
Prize Eligibility Cap: Only the first one hundred and one (101) submissions that achieve a Pass in all three categories above will be eligible for a prize. Once one hundred and one (101) qualifying submissions have been identified, no further prizes will be awarded, regardless of whether additional submissions also achieve a Pass.
PRIZES
The first 101 entries that achieve a Pass in all three judging categories are eligible for a prize consisting of an AWS Builder Jacket (approximate retail value $99 USD). Prizes are awarded in the order in which qualifying submissions were received.
A participant may receive at most one (1) prize from this Challenge. AWS Promotional Credits, if offered as part of any bonus or substituted prize, are subject to the terms and conditions set forth at https://aws.amazon.com/awscredits/ . AWS Promotional Credits have no monetary value. AWS reserves the right to substitute a prize (or portion thereof) for an item of comparable or greater value, at AWS's sole discretion.
WINNER NOTIFICATION & PRIZE DELIVERY
If you are selected as a winner, AWS will contact you using the email address you submitted to enter the Challenge. Winners will be notified via an updated article published to AWS Builder Center.
Failure to provide the requested information (including mailing address for jacket delivery) or to respond to communications about the Challenge within a reasonable period of time, as determined by AWS in its sole discretion, may result in the forfeiture of the prize.
ADDITIONAL TERMS
Entries that do not meet the requirements set forth in these Terms and Conditions may be disqualified in AWS's sole discretion.
By accepting the prize, you confirm that your receipt is neither prohibited nor inconsistent with any applicable laws, regulations, or binding orders, including applicable ethics or procurement rules, your receipt will not create a conflict of interest for AWS, and there are no ongoing competitive procurements for which your receipt of this benefit could conflict with AWS's participation in the competition.
The following personal information will be collected by AWS for the Challenge solely for the purposes of administering the Challenge and verifying participant eligibility: name, email address, and (for winners) mailing address. This information is handled in accordance with the AWS Privacy Notice (https://aws.amazon.com/privacy/ ).
A winners list will be available at builder.aws.com for up to a year after the date on which the article announcing the winners is published to the AWS Builder Center. Acceptance of prize by the winner constitutes permission for AWS to use winners' names or likenesses, and city, state or province, and country, if submitted to AWS, for any disclosures required by law, including a winners list, and for advertising and promotional purposes relating to the Challenge in any and all media now or hereafter devised, worldwide in perpetuity (or to the maximum extent permissible under applicable law), without additional compensation, notification or permission, unless prohibited by law.
TAX OBLIGATIONS
Winners are responsible for all federal, state, local, and foreign taxes associated with accepting and using a prize. Amazon may withhold taxes from prize payments where required by law.
Before receiving any prize, winners must provide all requested tax documentation (including IRS Form W-9 for U.S. persons or the appropriate IRS Form W-8 series for non-U.S. persons) to Amazon's prize administrator.
For physical prizes, winners are responsible for any import duties, taxes, or customs fees required by their jurisdiction. Amazon's fulfillment partners may facilitate delivery but do not assume responsibility for such charges.
Winners should consult their own tax advisors regarding the tax consequences of accepting a prize in their jurisdiction.