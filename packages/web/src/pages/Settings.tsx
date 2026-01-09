import { Button, Card, Input } from '../components/ui';

const Settings = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl font-bold">设置</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">账户设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">用户名</label>
                <Input type="text" defaultValue="user" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">邮箱</label>
                <Input type="email" defaultValue="user@example.com" disabled />
              </div>
              <Button variant="outline">修改密码</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">应用设置</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>深色模式</span>
                <Button variant="outline" size="sm">
                  切换
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>通知</span>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
