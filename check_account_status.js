import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
});

async function checkAccountStatus() {
  console.log('📊 OpenAI アカウント状況確認...\n');
  
  try {
    // 1. APIキーの基本確認
    console.log('1. APIキー情報');
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      console.log(`   形式: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
      console.log(`   長さ: ${apiKey.length}文字`);
      console.log(`   タイプ: ${apiKey.startsWith('sk-proj-') ? 'プロジェクトキー' : '不明'}`);
    }
    
    // 2. モデルアクセス確認
    console.log('\n2. モデルアクセス確認');
    try {
      const models = await openai.models.list();
      console.log('   ✅ API接続成功');
      
      const whisperModels = models.data.filter(model => model.id.includes('whisper'));
      if (whisperModels.length > 0) {
        console.log('   ✅ Whisperモデル利用可能');
        whisperModels.forEach(model => {
          console.log(`      - ${model.id}`);
        });
      } else {
        console.log('   ❌ Whisperモデルが見つかりません');
      }
    } catch (error) {
      console.log(`   ❌ API接続失敗: ${error.message}`);
    }
    
    // 3. 課金状況の推測（間接的確認）
    console.log('\n3. 課金状況の推測');
    try {
      // 小さなAPIコールでレスポンス時間とエラーを確認
      const start = Date.now();
      await openai.models.list();
      const duration = Date.now() - start;
      
      if (duration < 1000) {
        console.log('   ✅ 正常なレスポンス時間（課金アカウントの可能性大）');
      } else {
        console.log('   ⚠️ 遅いレスポンス時間（制限の可能性）');
      }
      
      // 複数回呼び出してレート制限を確認
      console.log('   レート制限テスト中...');
      let successCount = 0;
      for (let i = 0; i < 3; i++) {
        try {
          await openai.models.list();
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          if (error.message.includes('rate limit')) {
            console.log('   ⚠️ レート制限検出（無料アカウントの可能性）');
            break;
          }
        }
      }
      
      if (successCount === 3) {
        console.log('   ✅ レート制限なし（課金アカウントの可能性）');
      }
      
    } catch (error) {
      console.log(`   ❌ 課金状況確認失敗: ${error.message}`);
    }
    
    // 4. Whisper API権限の詳細確認
    console.log('\n4. Whisper API権限確認');
    try {
      // 空のリクエストで権限とエラー内容を確認
      await openai.audio.transcriptions.create({
        file: null,
        model: 'whisper-1',
      });
    } catch (error) {
      if (error.message.includes('file') || error.message.includes('required')) {
        console.log('   ✅ Whisper API権限あり（ファイル関連エラー）');
      } else if (error.message.includes('billing') || error.message.includes('payment')) {
        console.log('   ❌ 課金設定が必要です');
        console.log(`   詳細: ${error.message}`);
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        console.log('   ⚠️ 使用量制限に達している可能性');
        console.log(`   詳細: ${error.message}`);
      } else {
        console.log(`   🔍 その他のエラー: ${error.message}`);
      }
    }
    
    // 5. 推奨アクション
    console.log('\n📋 推奨アクション');
    console.log('   1. OpenAI Platform (https://platform.openai.com/) にログイン');
    console.log('   2. Billing > Payment methods で支払い方法を確認');
    console.log('   3. Usage で使用量と制限を確認');
    console.log('   4. docs/openai-billing-setup.md を参照');
    
  } catch (error) {
    console.error('❌ アカウント確認エラー:', error.message);
  }
}

// 実行
checkAccountStatus();