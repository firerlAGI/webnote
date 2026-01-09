import { Button, Card, Input } from '../components/ui';

const Profile = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl font-bold">个人资料</h1>
        </div>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-12 w-12 text-blue-600 dark:text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">用户名</h2>
          <p className="text-gray-600 dark:text-gray-400">user@example.com</p>
          <Button variant="outline" className="mt-4">
            更换头像
          </Button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">姓名</label>
              <Input type="text" defaultValue="用户名" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">昵称</label>
              <Input type="text" defaultValue="用户" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">简介</label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white min-h-32"
              defaultValue="这是个人简介"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline">取消</Button>
            <Button variant="primary">保存修改</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
